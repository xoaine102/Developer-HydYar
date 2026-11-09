# Developer HydYar

Nền tảng học tập + IDE + thực thi code + cộng đồng, phiên bản Full Project – Initial Release.
Build đầy đủ, chạy được thật. Xem `ARCHITECTURE.md` (lý do chọn công nghệ) và `DEPLOY.md` (hướng dẫn Render).

## Khởi chạy nhanh

```bash
cp .env.example .env        # điền DATABASE_URL (Postgres) + 2 secret JWT
npm install
npm run prisma:generate
npm run prisma:migrate      # hoặc npx prisma migrate dev (lần đầu)
npm run prisma:seed         # nạp 42 tài liệu học + 124 mục tra cứu (10 ngôn ngữ)
npm run dev                 # API :4000 + Web :5173
```

Build production: `npm run build` (shared → docs-data → api → web). API phục vụ tĩnh `apps/web/dist` trong production (một Render service duy nhất).

## Cấu trúc thư mục

```
apps/api        Express + Prisma + Socket.IO (16 file src, build → dist/)
apps/web        React + Vite + Tailwind + Monaco + xterm (361 module, build → dist/)
packages/shared Kiểu TypeScript + hợp đồng API (đóng băng)
packages/docs-data  Nội dung seed thật (42 learning docs + 124 app-doc entries)
prisma/         schema.prisma (đóng băng), migrations/, seed.ts (đồng nhất, có fallback)
CONTRACT.md     Hợp đồng API hai phía
DESIGN_TOKENS.md Hợp đồng theme/layout/overlay
ARCHITECTURE.md Lý do chọn công nghệ + đánh giá sandbox
DEPLOY.md       Hướng dẫn deploy Render + danh sách biến môi trường
```

## Tính năng đã triển khai & kiểm thử

| Hệ thống | Trạng thái | Kiểm thử |
|---|---|---|
| Auth (đăng ký/đăng nhập/refresh/httpOnly cookie/role user-admin/rate-limit) | ✅ thật | smoke test API, zod validation |
| Database schema + migration + seed (42 docs, 124 entries, 10 ngôn ngữ) | ✅ thật | prisma validate ✅, seed type-check ✅ |
| Knowledge: tài liệu học (TOC, prev/next, related, yêu thích, tiến độ) | ✅ thật | build ✅ |
| Knowledge: bảng tra cứu 4 cột (copy đúng, quy tắc chi tiết, ví dụ + ghi chú placeholder) + khóa hướng vuốt | ✅ thật | build ✅ |
| Floating DocOverlay (kéo/resize/ghim 4 cạnh/thu gọn lộ viền/nhiều overlay/full nội dung/không mất state IDE) | ✅ thật | build ✅ |
| Tìm kiếm thống nhất (gợi ý tức thì, lọc loại, điều hướng trực tiếp) | ✅ thật (Postgres ILIKE) | build ✅ |
| IDE: Monaco, File Explorer ảo, multi-tab, tạo/xóa/đổi tên file, lưu project, tìm kiếm | ✅ thật | build ✅ |
| Terminal UI (xterm, output + stdin) + Output console + Preview iframe sandboxed | ✅ thật | build ✅ |
| Thực thi local-first: JS/TS Web Worker, Python Pyodide (CDN), Lua Fengari, SQL sql.js, HTML/CSS/JS preview | ✅ thật | build ✅ |
| Thực thi server: hàng đợi, giới hạn CPU/output, temp dir per run, dọn dẹp, log ExecutionLog | ✅ thật (JS/TS/Python) | e2e: JS 78ms, Python 101ms, TS 442ms, vòng lặp vô hạn → killed timeout ✅ |
| SQL Environment: SQLite sql.js + dữ liệu mẫu + đặt lại | ✅ thật | build ✅ |
| Lua Graphics Studio: visual editor + Canvas 2D preview + animation + đồng bộ hai chiều marker block (code thủ công được bảo toàn) | ✅ thật | build ✅ |
| Cộng đồng: Forum (đăng/bình luận/trả lời/like/báo cáo/tìm kiếm) + Chat thời gian thực Socket.IO (trạng thái kết nối, presence) + đóng góp tài liệu (chờ duyệt) + Admin dashboard | ✅ thật | build ✅ |
| Tài khoản: hồ sơ, dự án, yêu thích, tiến độ | ✅ thật | build ✅ |
| Responsive 3 bố cục (desktop multi-pane, tablet drawer, mobile bottom-nav + IDE 5 tab riêng) | ✅ thật | build ✅ |
| Theme sáng/tối gradient xanh-tím (không trắng/đen thuần) | ✅ thật | build ✅ |
| Build toàn bộ monorepo từ sạch | ✅ | `npm run build` exit 0, 361 module ✅ |

## Giới hạn còn tồn tại (thành thật, không che giấu)

1. **Sandbox thật không khả thi trên Render Free** — không có Docker privileged/KVM/gVisor/Firecracker. Thực thi server dùng `child_process` với timeout + temp dir + strip env, nhưng đây KHÔNG phải ranh giới bảo mật. Đa thuê không tin cậy cần VPS trả phí + gVisor/Firecracker hoặc dịch vụ Piston/judge0. (ARCHITECTURE.md §3)
2. **Thực thi server chỉ hỗ trợ JS/TS/Python** (runtime có sẵn trong image Node của Render). C/C++/Java/C#/Go/Rust/PHP → trả `status:"unsupported"` với thông báo rõ ràng (không giả output). Các ngôn ngữ này vẫn chạy local trong trình duyệt nếu có WASM (Lua/SQL/JS/TS/Python).
3. **SQL Environment chỉ có SQLite** (client-side). PostgreSQL/MySQL ephemeral cho từng người dùng không khả thi trên Render Free — UI hiển thị panel giới hạn + phương án (kết nối DB của riêng người dùng — tính năng tương lai).
4. **Terminal không phải shell thật liên tục** — hiển thị output của lệnh đang chạy + nhận stdin. Render Free không cấp PTY riêng cho từng user.
5. **Giới hạn RAM Python** chỉ là tư vấn (chỉ Node có `--max-old-space-size`). Queue in-memory, mất khi restart (chấp nhận được vì run là stateless).
6. **Yêu thích/tiến độ học** lưu localStorage (chưa có endpoint server trong hợp đồng). Đồng bộ server là tính năng tương lai.
7. **Đồng bộ hai chiều Lua Studio** dùng parser marker-block đơn giản, không phải full Lua parser — code thủ công ngoài block được bảo toàn và hiện thông báo nếu không parse được (đúng spec).
8. **Môi trường Termux/App** trong mục Lập trình là info panel + starter code, không build thật (cần thiết bị/môi trường riêng).
9. **Render Free ngủ sau 15 phút** → cold start ~30s; Postgres Free hết hạn sau 90 ngày; cần backup định kỳ (DEPLOY.md).
10. **CDN dependencies** (Pyodide, sql.js wasm, Monaco workers, TypeScript transpiler) cần internet lúc runtime. Offline hoàn toàn chưa hỗ trợ.

## Biến môi trường

Xem `.env.example` và `DEPLOY.md` (bảng đầy đủ). Bắt buộc: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`.

## Kiểm thử đã thực hiện

- `npm install` + `npm run build` (toàn bộ 4 package) → exit 0.
- `npx prisma validate` → hợp lệ. `npx prisma generate` → OK.
- Type-check `prisma/seed.ts` + `apps/api` → 0 lỗi.
- Boot server đã build: `/api/health` 200, validation 400 đúng shape, route thiếu DB → 500 đúng shape (không crash).
- Execution e2e (có JWT thật): JS/Python/TS chạy ra output thật; C → `unsupported`; vòng lặp vô hạn → killed ở timeout.
- Cross-check 30+ call site frontend với CONTRACT.md → 0 endpoint không tồn tại.
