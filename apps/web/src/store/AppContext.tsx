import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { UserDTO } from "@hydyar/shared";
import { api, setAccessToken, getAccessToken } from "../lib/api";

// ===== Theme =====
type Theme = "light" | "dark";

// ===== Toasts =====
export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error";
}

// ===== Overlays =====
export type OverlayEdge = "left" | "right" | "top" | "bottom" | null;
export interface DocOverlayState {
  id: number;
  title: string;
  kind: "learning" | "markdown";
  lang?: string;
  slug?: string;
  /** preloaded markdown content (kind=markdown) */
  content?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  collapsed: boolean;
  edge: OverlayEdge;
}

interface AppState {
  theme: Theme;
  user: UserDTO | null;
  authLoading: boolean;
  toasts: Toast[];
  overlays: DocOverlayState[];
  overlayZTop: number;
  drawerOpen: boolean;
}

type Action =
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_USER"; user: UserDTO | null }
  | { type: "SET_AUTH_LOADING"; v: boolean }
  | { type: "PUSH_TOAST"; toast: Toast }
  | { type: "DISMISS_TOAST"; id: number }
  | { type: "OPEN_OVERLAY"; ov: DocOverlayState }
  | { type: "CLOSE_OVERLAY"; id: number }
  | { type: "FOCUS_OVERLAY"; id: number }
  | { type: "UPDATE_OVERLAY"; id: number; patch: Partial<DocOverlayState> }
  | { type: "SET_DRAWER"; open: boolean };

const initialState: AppState = {
  theme: (typeof localStorage !== "undefined" && (localStorage.getItem("hydyar-theme") as Theme)) || "light",
  user: null,
  authLoading: true,
  toasts: [],
  overlays: [],
  overlayZTop: 70,
  drawerOpen: false,
};

let toastSeq = 1;
let overlaySeq = 1;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_THEME":
      return { ...state, theme: action.theme };
    case "SET_USER":
      return { ...state, user: action.user, authLoading: false };
    case "SET_AUTH_LOADING":
      return { ...state, authLoading: action.v };
    case "PUSH_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast].slice(-5) };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "OPEN_OVERLAY": {
      const z = state.overlayZTop + 1;
      return { ...state, overlays: [...state.overlays, { ...action.ov, z }], overlayZTop: z };
    }
    case "CLOSE_OVERLAY":
      return { ...state, overlays: state.overlays.filter((o) => o.id !== action.id) };
    case "FOCUS_OVERLAY": {
      const z = state.overlayZTop + 1;
      return {
        ...state,
        overlayZTop: z,
        overlays: state.overlays.map((o) => (o.id === action.id ? { ...o, z, collapsed: false } : o)),
      };
    }
    case "UPDATE_OVERLAY":
      return { ...state, overlays: state.overlays.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)) };
    case "SET_DRAWER":
      return { ...state, drawerOpen: action.open };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  login: (token: string, user: UserDTO) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  toast: (message: string, type?: Toast["type"]) => void;
  openDocOverlay: (opts: { title: string; lang?: string; slug?: string; content?: string; kind?: "learning" | "markdown" }) => void;
  closeOverlay: (id: number) => void;
  focusOverlay: (id: number) => void;
  updateOverlay: (id: number, patch: Partial<DocOverlayState>) => void;
  setDrawer: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const bootstrapped = useRef(false);

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("hydyar-theme", state.theme);
  }, [state.theme]);

  // Bootstrap: try /api/me (token may be in memory only after login; on fresh load no token -> refresh attempt via cookie)
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        // Attempt refresh first (httpOnly cookie) to obtain access token in memory
        const ref = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (ref.ok) {
          const data = await ref.json();
          if (data?.accessToken) setAccessToken(data.accessToken);
        }
        if (getAccessToken()) {
          const me = await api<UserDTO>("/api/me", { noRedirect: true });
          dispatch({ type: "SET_USER", user: me });
          return;
        }
      } catch {
        /* ignore */
      }
      dispatch({ type: "SET_USER", user: null });
    })();
  }, []);

  const setTheme = useCallback((t: Theme) => dispatch({ type: "SET_THEME", theme: t }), []);
  const toggleTheme = useCallback(() => dispatch({ type: "SET_THEME", theme: state.theme === "light" ? "dark" : "light" }), [state.theme]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = toastSeq++;
    dispatch({ type: "PUSH_TOAST", toast: { id, message, type } });
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", id }), 4200);
  }, []);

  const login = useCallback((token: string, user: UserDTO) => {
    setAccessToken(token);
    dispatch({ type: "SET_USER", user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST", noRedirect: true });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    dispatch({ type: "SET_USER", user: null });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api<UserDTO>("/api/me", { noRedirect: true });
      dispatch({ type: "SET_USER", user: me });
    } catch {
      /* ignore */
    }
  }, []);

  const openDocOverlay = useCallback(
    (opts: { title: string; lang?: string; slug?: string; content?: string; kind?: "learning" | "markdown" }) => {
      const id = overlaySeq++;
      const w = Math.min(520, window.innerWidth - 32);
      const h = Math.min(560, window.innerHeight - 80);
      const x = Math.max(16, window.innerWidth - w - 40 - (state.overlays.length % 4) * 28);
      const y = Math.max(60, 80 + (state.overlays.length % 4) * 24);
      dispatch({
        type: "OPEN_OVERLAY",
        ov: {
          id,
          title: opts.title,
          kind: opts.kind ?? (opts.slug ? "learning" : "markdown"),
          lang: opts.lang,
          slug: opts.slug,
          content: opts.content,
          x,
          y,
          w,
          h,
          z: 0,
          collapsed: false,
          edge: null,
        },
      });
    },
    [state.overlays.length]
  );

  const closeOverlay = useCallback((id: number) => dispatch({ type: "CLOSE_OVERLAY", id }), []);
  const focusOverlay = useCallback((id: number) => dispatch({ type: "FOCUS_OVERLAY", id }), []);
  const updateOverlay = useCallback((id: number, patch: Partial<DocOverlayState>) => dispatch({ type: "UPDATE_OVERLAY", id, patch }), []);
  const setDrawer = useCallback((open: boolean) => dispatch({ type: "SET_DRAWER", open }), []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      toggleTheme,
      setTheme,
      login,
      logout,
      refreshMe,
      toast,
      openDocOverlay,
      closeOverlay,
      focusOverlay,
      updateOverlay,
      setDrawer,
    }),
    [state, toggleTheme, setTheme, login, logout, refreshMe, toast, openDocOverlay, closeOverlay, focusOverlay, updateOverlay, setDrawer]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Convenience hook: isAdmin
export function useIsAdmin() {
  const { user } = useApp();
  return user?.role === "ADMIN";
}
