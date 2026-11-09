// Fetch wrapper: in-memory access token, 401 -> refresh once -> retry, else redirect to /login.
// Error shape per CONTRACT.md: { error: { code, message } }.

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function doRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const tok: string | undefined = data?.accessToken;
      if (tok) {
        accessToken = tok;
        return tok;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** skip auth header (e.g. login/register) */
  noAuth?: boolean;
  /** do not redirect to login on final 401 */
  noRedirect?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
  if (!opts.noAuth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    });
  } catch (e) {
    throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối tới máy chủ. Kiểm tra mạng hoặc API chưa chạy.");
  }

  if (res.status === 401 && !opts.noAuth && !opts.noRedirect) {
    const newTok = await doRefresh();
    if (newTok) {
      headers["Authorization"] = `Bearer ${newTok}`;
      try {
        res = await fetch(path, {
          method: opts.method ?? (opts.body ? "POST" : "GET"),
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          credentials: "include",
        });
      } catch {
        throw new ApiError(0, "NETWORK_ERROR", "Không thể kết nối tới máy chủ.");
      }
    }
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && !opts.noRedirect) {
      setAccessToken(null);
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `Yêu cầu thất bại (${res.status}).`);
  }
  return data as T;
}
