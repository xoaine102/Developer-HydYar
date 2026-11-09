# Developer HydYar — Frozen Contract (do not change without syncing both sides)

Project root: `/home/user/developer-hydyar`. Workspaces: `apps/api`, `apps/web`, `packages/shared`, `packages/docs-data`.

## File ownership (parallel agents — do NOT write outside your scope)
- **Backend agent**: `apps/api/**`, `prisma/migrations/**`, `prisma/seed.ts` (imports from `@hydyar/docs-data`).
- **Frontend agent**: `apps/web/**`.
- **Docs-data agent**: `packages/docs-data/**` (real seed content) + `prisma/seed-data.ts` re-export.

## Auth
- `POST /api/auth/register` {email, username, password} → sets httpOnly refresh cookie, returns {user, accessToken}.
- `POST /api/auth/login` same. `POST /api/auth/logout`. `POST /api/auth/refresh` (cookie) → new access token.
- `GET /api/me` → UserDTO. `PATCH /api/me` {bio?, avatarUrl?, username?}.
- Access token: `Authorization: Bearer <jwt>`. Refresh token: httpOnly cookie `hydyar_refresh`.
- First registered user (or email matching BOOTSTRAP_ADMIN_EMAIL) → role ADMIN.

## Docs
- `GET /api/docs/languages` → [{code, name, learningCount, appEntryCount}].
- `GET /api/docs/:lang/learning` → LearningDocMeta[] (ordered).
- `GET /api/docs/:lang/learning/:slug` → LearningDocFull.
- `GET /api/docs/:lang/application?category=` → AppDocEntryDTO[] grouped by category.
- `GET /api/search?q=&type=` → SearchResultItem[] (Postgres tsvector on docs + posts + projects; diacritic-insensitive via unaccent if available else lower()).

## Projects & files
- `GET /api/projects` (auth) → ProjectDTO[]. `POST /api/projects` {name, language?, files?}.
- `GET /api/projects/:id` → ProjectDTO + files: ProjectFileDTO[].
- `PUT /api/projects/:id` {name?, description?}. `DELETE /api/projects/:id`.
- `PUT /api/projects/:id/files` {path, content, language?} (upsert one file). `DELETE /api/projects/:id/files?path=`.

## Execution (server side)
- `POST /api/execute` (auth, rate-limited) ExecuteRequest → 202 {runId, status:"queued", message}.
- `GET /api/execute/:runId` → ExecuteResponse (poll). Server-capable: javascript, typescript, python only. Others → status "unsupported" with honest limitation message (never fake output).
- Limits from env: EXEC_MAX_CPU_MS, EXEC_MAX_MEM_MB, EXEC_MAX_OUTPUT_KB, EXEC_CONCURRENCY, EXEC_QUEUE_MAX. In-memory queue; child_process with timeout + maxBuffer; destroy + cleanup after each run. No network granted (documented limitation: child_process is not true isolation — see ARCHITECTURE.md).

## Forum
- `GET /api/posts?tag=&q=` → ForumPostDTO[]. `POST /api/posts` (auth) {title, content, codeSnippet?, language?, tags[], projectId?}.
- `GET /api/posts/:id` → ForumPostDTO + comments (nested replies). `DELETE /api/posts/:id` (owner/admin).
- `POST /api/posts/:id/comments` {content, parentId?, codeSnippet?}. `DELETE /api/comments/:id` (owner/admin).
- `POST /api/posts/:id/like` (toggle). `POST /api/posts/:id/report` {reason}.

## Doc suggestions (community contribution)
- `POST /api/doc-suggestions` (auth) {kind, lang, title, content}.
- `GET /api/doc-suggestions/mine` → mine. `GET /api/doc-suggestions` (admin) → all pending+others.
- `PATCH /api/doc-suggestions/:id` (admin) {status, feedback?}. On APPROVE for LEARNING: insert into LearningDoc (admin may edit before).

## Chat (WebSocket)
- Endpoint: `/ws` (Socket.IO path `/socket.io` or raw ws at `/ws` — backend picks, frontend matches). Events: `join_room {roomId}`, `message {roomId, content}` (auth via token in handshake query), `message` broadcast {id, roomId, user{id,username}, content, createdAt}, `presence` {roomId, onlineCount}. Connection status indicator required in UI.
- `GET /api/chat/rooms` → [{id, name, description}]. Seed 3 rooms: "chung", "javascript", "python".

## Admin
- `GET /api/admin/stats` (admin) → {users, projects, posts, pendingSuggestions, executionsToday}.
- `GET /api/admin/reports` → open PostReport[]; `PATCH /api/admin/reports/:id` {status}.

## SQL environment
- SQLite runs client-side via sql.js (frontend owns). Server Postgres/MySQL ephemeral NOT implemented on Render Free → UI shows honest limitation panel. No server endpoint.

## Frontend routes (frontend owns; backend href in search must match)
- `/` overview; `/database` (DB info page under Tổng quan)
- `/docs/:lang` (learning index), `/docs/:lang/learn/:slug`, `/docs/:lang/reference` (application table)
- `/ide`, `/ide/:projectId`; `/sql`; `/lua-studio`
- `/community/forum`, `/community/chat`
- `/account/profile`, `/account/support`; `/admin` (admin only)
- Docs can also open as floating overlay from any page (state preserved).

## Error shape
All errors: `{error: {code: string, message: string}}`. HTTP status meaningful (400/401/403/404/409/429/500). Never 200 with fake success.
