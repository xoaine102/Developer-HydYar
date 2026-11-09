# Developer HydYar — Deployment Guide (Render)

## Prerequisites
- GitHub repository with this source.
- Render account.
- A Render PostgreSQL instance (Free tier OK for initial).

## Option A — Single Web Service (recommended for Free)

The API serves the built frontend statically, so one service hosts both.

1. **Create PostgreSQL** on Render → copy `DATABASE_URL` (internal connection string).
2. **New → Web Service**, connect your GitHub repo.
   - **Runtime**: Node
   - **Build Command**:
     ```
     npm install && npm run build -w @hydyar/shared && npm run build -w @hydyar/docs-data && npm run build -w @hydyar/api && npm run build -w @hydyar/web && npx prisma generate
     ```
   - **Start Command**:
     ```
     npx prisma migrate deploy && npx tsx prisma/seed.ts && node apps/api/dist/index.js
     ```
     (If `tsx` not available in prod: `node --experimental-strip-types` or precompile seed. Simpler: add `"seed": "tsx prisma/seed.ts"` and run `npm run prisma:seed`.)
   - **Instance Type**: Free (or Starter for reliability).
3. **Environment Variables** (see full list below). Set `NODE_ENV=production`, `WEB_ORIGIN=https://<your-service>.onrender.com`.
4. First deploy runs migrations + seed automatically. Subsequent deploys re-run `migrate deploy` (idempotent) + seed (idempotent — clears doc tables then re-inserts).

## Option B — Static Site + separate API Service

1. **Static Site** from repo: Build Command `npm install && npm run build -w @hydyar/web`, Publish Directory `apps/web/dist`. Set env `VITE_API_URL=https://<api-service>.onrender.com` (frontend must read it).
2. **Web Service** for API: Build `npm install && npm run build -w @hydyar/shared && npm run build -w @hydyar/api && npx prisma generate`, Start `npx prisma migrate deploy && node apps/api/dist/index.js`.
3. Set API `WEB_ORIGIN` to the static site URL.

## Environment variables (full list)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Render Postgres connection string |
| `JWT_ACCESS_SECRET` | yes | — | min 32 chars, random |
| `JWT_REFRESH_SECRET` | yes | — | min 32 chars, random, different from access |
| `ACCESS_TOKEN_TTL` | no | `15m` | |
| `REFRESH_TOKEN_TTL` | no | `7d` | |
| `WEB_ORIGIN` | yes | `http://localhost:5173` | CORS origin (your frontend URL) |
| `PORT` | no | `4000` | Render sets this automatically |
| `EXEC_MAX_CPU_MS` | no | `8000` | server-run timeout |
| `EXEC_MAX_MEM_MB` | no | `256` | advisory |
| `EXEC_MAX_OUTPUT_KB` | no | `64` | output cap |
| `EXEC_QUEUE_MAX` | no | `20` | queue depth |
| `EXEC_CONCURRENCY` | no | `2` | parallel server runs |
| `BOOTSTRAP_ADMIN_EMAIL` | no | — | first matching registration becomes ADMIN |
| `NODE_ENV` | no | — | set `production` on Render |

## Local run

```bash
cp .env.example .env   # set DATABASE_URL to a local/Render Postgres
npm install
npm run prisma:generate
npm run prisma:migrate   # or: npx prisma migrate dev
npm run prisma:seed
npm run dev              # api :4000 + web :5173 concurrently
```

## Render Free limitations you will hit (honest)

- **Sleep after 15 min idle** → first request cold-starts (~30s). Upgrade to Starter to avoid.
- **Ephemeral disk** → uploads/file storage on disk won't persist. We store everything in Postgres; execution temp dirs are intentionally ephemeral.
- **512MB RAM** → Monaco + Pyodide load client-side (fine). Server concurrency kept at 2.
- **No privileged containers** → true sandbox (gVisor/Firecracker) impossible. Server execution uses child_process with timeout + stripped env. See ARCHITECTURE.md §3. Upgrade to a VPS + gVisor or Piston-like service for untrusted multi-tenant execution.
- **No compilers in the Node image** → C/C++/Java/C#/Go/Rust server execution returns `unsupported`. Local execution (browser) is unaffected for JS/TS/Python/Lua/SQL/HTML/CSS.
- **Managed Postgres Free expires after 90 days** → back up or upgrade before expiry.

## Backup

- Render Postgres provides daily backups on paid tiers. On Free: run `pg_dump` periodically via cron (`pg_dump $DATABASE_URL > backup_$(date +%F).sql`).
- Seed docs are deterministic — re-seed anytime; user-generated data (users/projects/posts) is what must be backed up.
