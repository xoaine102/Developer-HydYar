// Server-side code execution engine.
//
// SECURITY NOTE (documented limitation): child_process is NOT true sandbox
// isolation. Submitted code runs as the same OS user as the API process with
// the same filesystem/network access. We mitigate with: fresh per-run temp
// working directory (deleted after), CPU timeout, output buffer cap, and a
// stripped environment. A true sandbox (gVisor / Firecracker / nsjail / Docker)
// is not available on Render Free. C/C++/Java/Go/Rust/PHP/C# are NOT executed
// server-side — they return status:"unsupported" with an honest message. The
// frontend runs them locally (or shows the limitation panel). NEVER fabricate
// output.
import { exec, execSync, type ExecException } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ExecuteRequest, ExecuteStatus, ProjectFileDTO } from "@hydyar/shared";
import { SERVER_CAPABLE_LANGUAGES } from "@hydyar/shared";
import { prisma } from "./prisma.js";
import { config } from "../config.js";

export interface RunState {
  runId: string;
  status: ExecuteStatus;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  message?: string;
  runtime: "server" | "local";
  createdAt: number;
}

export interface QueuedJob {
  runId: string;
  request: ExecuteRequest;
  userId?: string;
}

const runs = new Map<string, RunState>();
const queue: QueuedJob[] = [];
let active = 0;

/** Single-quote escape for building a shell command (args are fully controlled by us). */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Best-effort binary detection (Linux `command -v`; Render runs on Linux). */
function hasBinary(name: string): boolean {
  try {
    execSync(`command -v ${JSON.stringify(name)}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Locate a locally-installed tsx binary (devDependency) so TypeScript can run when present. */
function findTsx(): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules", ".bin", "tsx"),
    path.join(process.cwd(), "..", "..", "node_modules", ".bin", "tsx"),
    path.join(process.cwd(), "..", "node_modules", ".bin", "tsx"),
  ];
  for (const c of candidates) {
    try {
      execSync(`test -x ${JSON.stringify(c)}`, { stdio: "ignore" });
      return c;
    } catch {
      /* try next */
    }
  }
  return hasBinary("tsx") ? "tsx" : null;
}

const NODE_MAJOR = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

interface ResolvedCommand {
  bin: string;
  args: string[];
  entryFile: string; // relative to temp dir
  message?: string;
}

/**
 * Resolve how to run a language. Returns null (→ "unsupported") when no
 * runtime is available. We never fake execution.
 */
function resolveCommand(language: string): ResolvedCommand | null {
  const lang = language.toLowerCase();
  if (lang === "javascript" || lang === "js") {
    return { bin: process.execPath, args: ["entry.js"], entryFile: "entry.js" };
  }
  if (lang === "typescript" || lang === "ts") {
    const tsx = findTsx();
    if (tsx) return { bin: tsx, args: ["entry.ts"], entryFile: "entry.ts" };
    // Node 22.6+ can strip types directly — no extra dependency required.
    if (NODE_MAJOR >= 22) {
      return {
        bin: process.execPath,
        args: ["--experimental-strip-types", "entry.ts"],
        entryFile: "entry.ts",
        message: "TypeScript run via node --experimental-strip-types (enums/namespaces not supported; install tsx for full TS).",
      };
    }
    return null;
  }
  if (lang === "python" || lang === "py") {
    if (hasBinary("python3")) return { bin: "python3", args: ["entry.py"], entryFile: "entry.py" };
    if (hasBinary("python")) return { bin: "python", args: ["entry.py"], entryFile: "entry.py" };
    return null;
  }
  return null;
}

function truncate(s: string, maxBytes: number): string {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= maxBytes) return s;
  return buf.subarray(0, maxBytes).toString("utf8") + "\n...[output truncated]";
}

async function writeProjectFiles(dir: string, files: ProjectFileDTO[] | undefined): Promise<void> {
  if (!files) return;
  for (const f of files) {
    // Prevent path traversal outside the temp dir.
    const normalized = path.normalize(f.path).replace(/^(\.\.[/\\])+/, "");
    if (path.isAbsolute(normalized) || normalized.startsWith("..")) continue;
    const full = path.join(dir, normalized);
    if (!full.startsWith(dir)) continue;
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, f.content ?? "");
  }
}

function finish(runId: string, patch: Partial<RunState>, job: QueuedJob, startedAt: number): void {
  const state = runs.get(runId);
  if (state) {
    Object.assign(state, patch, { durationMs: patch.durationMs ?? Date.now() - startedAt });
  }
  // Persist audit log (best-effort; failures here must not break the response).
  const s = runs.get(runId);
  void prisma.executionLog
    .create({
      data: {
        userId: job.userId,
        language: job.request.language,
        runtime: "server",
        status: s?.status ?? patch.status ?? "error",
        output: truncate(`${s?.stdout ?? ""}${s?.stderr ?? ""}`, 8 * 1024),
        durationMs: s?.durationMs,
      },
    })
    .catch((e) => console.warn("[execute] log persist failed:", e?.message ?? e));
}

async function runJob(job: QueuedJob): Promise<void> {
  active += 1;
  const startedAt = Date.now();
  const state = runs.get(job.runId);
  if (state) state.status = "running";

  let dir: string | null = null;
  try {
    const lang = job.request.language.toLowerCase();
    if (!SERVER_CAPABLE_LANGUAGES.includes(lang as (typeof SERVER_CAPABLE_LANGUAGES)[number])) {
      finish(
        job.runId,
        {
          status: "unsupported",
          message: `Server execution for "${job.request.language}" is not available on this host. ` +
            `Supported server-side runtimes: javascript, typescript, python. Run other languages locally or in the browser IDE.`,
        },
        job,
        startedAt,
      );
      return;
    }

    const cmd = resolveCommand(job.request.language);
    if (!cmd) {
      finish(
        job.runId,
        {
          status: "unsupported",
          message: `Runtime for "${job.request.language}" is not installed on the server. ` +
            `Install it locally or use JavaScript/Python which are always available.`,
        },
        job,
        startedAt,
      );
      return;
    }

    dir = await mkdtemp(path.join(tmpdir(), "hydyar-exec-"));
    await writeProjectFiles(dir, job.request.files);
    await writeFile(path.join(dir, cmd.entryFile), job.request.code ?? "");

    const maxBytes = config.exec.maxOutputKb * 1024;
    // Stripped environment: PATH + a throwaway HOME only. No secrets propagated.
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: dir,
      NODE_ENV: "production",
    };
    if (cmd.bin === process.execPath || cmd.bin.endsWith("node")) {
      env.NODE_OPTIONS = `--max-old-space-size=${config.exec.maxMemMb}`;
    }

    // Build the shell command up front (stdin via temp file redirect).
    let cmdLine = [cmd.bin, ...cmd.args].map(shellEscape).join(" ");
    if (job.request.stdin) {
      const stdinPath = path.join(dir, ".hydyar-stdin");
      await writeFile(stdinPath, job.request.stdin);
      cmdLine = `${cmdLine} < ${shellEscape(stdinPath)}`;
    }

    const result = await new Promise<{ status: ExecuteStatus; stdout: string; stderr: string; message?: string }>(
      (resolve) => {
        // We control bin + args entirely (fixed entry filenames), so shell quoting is safe.
        const child = exec(
          cmdLine,
          {
            timeout: config.exec.maxCpuMs,
            maxBuffer: maxBytes,
            cwd: dir!,
            env,
            killSignal: "SIGKILL",
          },
          (err: ExecException | null, stdout: string, stderr: string) => {
            const out = truncate(stdout ?? "", maxBytes);
            const errOut = truncate(stderr ?? "", maxBytes);
            if (err) {
              // execFile signals timeout via err.killed + signal SIGKILL (we set killSignal).
              if (err.killed) {
                return resolve({ status: "timeout", stdout: out, stderr: errOut, message: `Execution exceeded ${config.exec.maxCpuMs}ms CPU limit and was killed.` });
              }
              if ((err as { code?: string }).code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
                return resolve({ status: "error", stdout: out, stderr: errOut, message: `Output exceeded ${config.exec.maxOutputKb}KB limit.` });
              }
              return resolve({ status: "error", stdout: out, stderr: errOut });
            }
            return resolve({ status: "success", stdout: out, stderr: errOut });
          },
        );
        // Hard kill fallback in case timeout event doesn't fire.
        const hardKill = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            /* already gone */
          }
        }, config.exec.maxCpuMs + 1000);
        child.on("exit", () => clearTimeout(hardKill));
      },
    );

    finish(job.runId, { status: result.status, stdout: result.stdout, stderr: result.stderr, message: result.message ?? cmd.message }, job, startedAt);
  } catch (e) {
    finish(
      job.runId,
      {
        status: "error",
        stderr: String((e as Error)?.message ?? e),
        message: "Runner internal error",
      },
      job,
      startedAt,
    );
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    active -= 1;
    pump();
  }
}

function pump(): void {
  while (active < config.exec.concurrency && queue.length > 0) {
    const job = queue.shift();
    if (job) void runJob(job);
  }
}

/** Enqueue a run. Throws 429 when the queue is full. Returns the runId. */
export function enqueueRun(request: ExecuteRequest, userId?: string): string {
  if (queue.length >= config.exec.queueMax) {
    throw Object.assign(new Error("queue full"), { status: 429, code: "QUEUE_FULL" });
  }
  const runId = randomUUID();
  runs.set(runId, { runId, status: "queued", runtime: "server", createdAt: Date.now(), message: `queued: position ${queue.length + 1}` });
  queue.push({ runId, request, userId });
  pump();
  return runId;
}

export function getRun(runId: string): RunState | undefined {
  return runs.get(runId);
}

// Evict finished runs older than 10 minutes so the map doesn't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, state] of runs) {
    if (state.status !== "queued" && state.status !== "running" && state.createdAt < cutoff) {
      runs.delete(id);
    }
  }
}, 60 * 1000).unref?.();
