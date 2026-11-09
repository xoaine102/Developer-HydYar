# Developer HydYar — Architecture & Technology Choices

Version 1.0.0 — Initial Release. Monorepo at `/home/user/developer-hydyar`.

## 1. Technology stack (and why)

| Layer | Choice | Reason |
|---|---|---|
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | Single source of truth for shared types; one `npm install`; Render-friendly. |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Mature, fast HMR, huge ecosystem, easy maintenance. Vite build is fast and outputs static `dist/` the API can serve. |
| Backend | Node.js + Express 4 + TypeScript | Simple, well-understood, works on Render out of the box. Fastify considered but Express has broader compatibility with Socket.IO middleware patterns. |
| Database | PostgreSQL (managed by Render) + Prisma ORM | Relational data fits (users, projects, docs, forum). Prisma gives typed client + migrations + seed. SQLite rejected for primary DB (Render disk is ephemeral — no durable storage on Free). |
| Auth | JWT access (15m, in-memory on client) + refresh token (7d, httpOnly cookie, hashed in DB) + bcryptjs | httpOnly cookie resists XSS exfiltration; short access token limits damage. Roles USER/ADMIN. |
| Realtime | Socket.IO (WebSocket + long-poll fallback) | Battle-tested, works behind Render proxies, rooms + presence built-in. |
| Editor | Monaco Editor (`@monaco-editor/react`) | Same engine as VS Code: syntax highlight + autocomplete + diagnostics for 20+ languages out of the box. |
| Terminal UI | xterm.js | Renders output + accepts stdin. **Not** a real shell on Render Free (no persistent PTY per user) — see Limitations. |
| Local runtimes | JS/TS: Web Worker; Python: Pyodide (WASM, CDN); Lua: Fengari (WASM); SQL: sql.js (SQLite WASM); HTML/CSS/JS: sandboxed iframe | Local-first per spec: offloads server, zero queue, works offline after CDN load. |
| Server execution | `child_process` per run, fresh temp dir, timeout + maxBuffer, in-memory queue | Only option on Render Free (no privileged Docker, no KVM/gVisor/Firecracker). **Not true isolation** — see Limitations §3. |
| Search | Postgres `to_tsvector` + `ILIKE` fallback | No Elasticsearch (too heavy for Render Free). Diacritic-insensitive via `unaccent` extension when available, else lower() + ILIKE. |

## 2. Repository structure

```
developer-hydyar/
├── apps/
│   ├── api/                 # Express + Prisma + Socket.IO (src/, dist/)
│   └── web/                 # React + Vite (src/, dist/)
├── packages/
│   ├── shared/              # Frozen TypeScript types + API contract
│   └── docs-data/           # Real seed documentation content (learning + app tables)
├── prisma/
│   ├── schema.prisma        # Frozen DB schema
│   ├── migrations/
│   └── seed.ts              # Idempotent seed (imports docs-data + inline fallback)
├── CONTRACT.md              # Frozen API contract (both sides must match)
├── DESIGN_TOKENS.md         # Frozen theme/layout/overlay contracts
├── ARCHITECTURE.md          # This file
├── DEPLOY.md                # Render deployment guide
├── README.md                # Setup + feature/limitation report
├── .env.example
└── package.json             # Workspace root
```

## 3. Execution & sandbox model (honest assessment)

Spec requires strong sandboxing. **Render Free cannot provide true isolation**: no privileged Docker, no KVM, no gVisor, no MicroVM. Therefore:

- **Local-first is the primary execution path** (JS/TS, Python, Lua, SQL, HTML/CSS/JS). No server resource consumed.
- **Server execution** exists only for JS/TS/Python (runtimes present in Render's Node image + `python3`). It uses `child_process.spawn` with:
  - fresh temp directory per run (deleted in `finally`),
  - `timeout` = `EXEC_MAX_CPU_MS` (default 8s), process killed on timeout,
  - `maxBuffer` = `EXEC_MAX_OUTPUT_KB` (default 64KB), output truncated,
  - in-memory queue with `EXEC_CONCURRENCY` (default 2) and `EXEC_QUEUE_MAX` (default 20),
  - no network egress *by convention* (no proxy/env vars; but `child_process` cannot block syscalls — see below).
- **Known limitation**: `child_process` is NOT a security boundary. A malicious Python/Node program can read files inside the container, read env vars (we strip known secrets via `env` whitelist), and make outbound network calls. We strip `DATABASE_URL`, JWT secrets, and internal hostnames from the child's env, and we do not mount the DB socket — but a determined user can still exfiltrate via DNS/HTTPS. **Do not run untrusted multi-tenant code on this tier.**
- **Recommended upgrade path** (documented, not built): a paid VPS / Fly Machines / AWS Fargate with gVisor (`runsc`) or Firecracker MicroVM, or a managed service like Piston / EngineYard / judge0. Queue moves to Redis (BullMQ). This is why `EXEC_*` env vars and the queue interface are already abstracted.

## 4. Data separation & security

- User data, projects, docs, community, execution history each in separate tables with ownership columns; every mutating endpoint checks `userId` or admin role (zod-validated input).
- Sandbox (server execution) never touches the main DB: no DATABASE_URL in child env, separate temp dir, process destroyed after run. Project files persist in `ProjectFile` table (not on disk) so sandbox cleanup never deletes user work.
- SQL environment: client-side SQLite (sql.js). Postgres/MySQL ephemeral per-user DBs are not feasible on Render Free (would require a dedicated Postgres service per session) — UI shows honest limitation + alternative (connect own DB string — future).
- Rate limits: auth 5/min/IP, execute 10/min/user, general 60/min/IP.

## 5. Render Free constraints baked into design

- Ephemeral filesystem → no SQLite on disk, no file-based projects; everything in Postgres. Temp dirs for execution are fine (ephemeral).
- 512MB RAM / 0.1 CPU → `EXEC_CONCURRENCY=2`, `EXEC_MAX_MEM_MB=256` (enforced via `--max-old-space-size` for Node; Python memory limit is advisory only — limitation).
- No background workers → queue is in-memory (lost on restart — acceptable; runs are stateless).
- 15min inactivity spin-down → on startup: run `prisma migrate deploy` + seed (idempotent), rebuild in-memory queue empty.
- Single service recommended: API serves `../web/dist` statically + SPA fallback. (Alternative: two Render services, one static site + one web service — documented in DEPLOY.md.)

## 6. What is intentionally NOT claimed as done (see README §Limitations)

- True sandbox isolation / network blocking for server execution.
- C/C++/Java/C#/Go/Rust/PHP server-side execution (no compilers in Render image; PHP may be present but untested → marked unsupported).
- Real persistent terminal shell per user (xterm shows output + stdin to the running process only).
- PostgreSQL/MySQL ephemeral practice environments (SQLite only).
- Full Lua parser for two-way sync — simple marker-block parser; unparseable manual code is preserved with a notification (per spec).
