# 08 — HuaCloud Personal Cloud (Kế hoạch thực thi)

Ngày: 2026-07-12 · Owner: Hứa Hưng

> File này là **kế hoạch đang chạy** cho đúng nhu cầu đã chốt: kho ảnh **cá nhân**,
> ảnh gốc lưu trên **Telegram** (đỡ tốn ổ cứng), truy cập **từ xa** (điện thoại),
> có **đăng nhập** bảo vệ. **Chưa làm AI** (bật sau chỉ cần thêm API key).
> Thay thế cho roadmap SaaS 7 phase ở [04](04_DEVELOPMENT_ROADMAP.md) — phần lớn roadmap đó
> là over-engineering cho nhu cầu cá nhân.

---

## Cắt scope — làm gì / KHÔNG làm

| Làm | KHÔNG làm (cắt khỏi roadmap 04) |
|---|---|
| Upload → Telegram lưu gốc → xem/tải/xoá | Share link công khai, QR, password |
| Đăng nhập 1 tài khoản (của Hưng) | API key, REST public API |
| Gallery, favorite, trash, rename, dedupe | Multi-workspace, mời thành viên, billing |
| Thumbnail/preview nhanh | AI caption/tag/OCR/vector search (để sau) |
| Deploy từ xa (Vercel) | Analytics, admin panel, i18n, landing SaaS |

Nguyên tắc giữ nguyên từ code hiện tại: **UI không phụ thuộc Telegram** (Telegram nằm sau
`StorageDriver`); mọi secret trong `.env.local`; đổi schema qua `prisma migrate`.

---

## CHẶNG A — Chạy ngon trên máy (local-first)

Mục tiêu: Hưng dùng được ngay trên máy, và chứng minh luồng Telegram hoạt động
TRƯỚC khi thêm phức tạp cloud.

- [x] **A1. Chống sập upload** (đã xong, đã verify)
  - Chặn theo `content-length` **trước** `req.formData()` → file > 20MB trả 413 ngay, không nạp vào RAM. [route.ts](../src/app/api/upload/route.ts)
  - Sharp: `limitInputPixels` 100MP + từ chối ảnh vượt pixel; xử lý **tuần tự** thay vì 4 bản song song; dominant color tính trên thumb. [process.ts](../src/server/media/process.ts)
  - Queue: guard `unhandledRejection` không cho crash kéo sập server. [queue.ts](../src/server/jobs/queue.ts)
  - Log chẩn đoán RAM theo asset. [memory.ts](../src/server/diagnostics/memory.ts)
  - Test 3 ca: happy (checksum khớp), file 21.5MB → 413, ảnh 110MP → không sập. `npm run test:upload -- --all`
- [x] **A2. Nối Telegram thật** (xong)
  - Bot **@HuaCloud_bot**, lưu vào **chat riêng** với bot (Chat ID `5921650739`). `telegram:setup` đã sửa để nhận cả private chat.
  - `telegram:health` xanh: gửi/đọc/xoá file OK. `/api/health` → `telegram.ok: true`.
- [x] **A3. Verify end-to-end** (xong): upload ảnh → **ORIGINAL lên Telegram (msg#3)**, staging tự xoá; tải gốc checksum khớp 100%; hard delete → row mất + message Telegram bị xoá + `/f` trả 404. Đã dọn sạch 15 asset test cũ theo yêu cầu (kho về 0).

**Xong chặng A = Hưng có kho ảnh cá nhân dùng thật trên máy.**

---

## CHẶNG B — Đưa lên mây để dùng từ xa

> **TẠM HOÃN (12/07/2026):** Hưng chốt **chỉ dùng trên máy là đủ** — không deploy.
> Chặng B để dành; khi nào muốn xem từ điện thoại thì làm tiếp (cần Neon + Vercel).
> Riêng **B3 (đăng nhập) đã làm xong**, giữ lại như tính năng khóa mật khẩu tùy chọn.

Vì Vercel serverless không có ổ đĩa bền → phải đổi 3 thứ; ~90% còn lại tái dùng nguyên.

- [ ] **B1. Database → Postgres (Neon)**: đổi `datasource` sang postgres, chuyển cột String→enum/Json thật, `migrate` trên Neon branch. (Cần: tài khoản Neon)
- [ ] **B2. Derivatives → cloud storage**: thumb/preview từ `.data/` local sang **Vercel Blob** (hoặc R2). Original vẫn ở Telegram. (Quyết định khi bắt đầu: Blob vs R2)
- [x] **B3. Đăng nhập 1 tài khoản** (xong, verify 7/7): cookie ký HMAC (edge-safe), middleware bảo vệ toàn app, chỉ bật khi đặt `APP_PASSWORD` (local để trống = vào thẳng). Files: `src/lib/auth.ts`, `src/middleware.ts`, `src/app/login`, `api/login`+`logout`.
- [ ] **B4. Queue → serverless-safe**: queue in-process không sống trên serverless → chuyển sang xử lý inline khi upload hoặc Inngest. Upload lớn: client upload thẳng lên Blob staging (né giới hạn body 4.5MB của Vercel).
- [ ] **B5. Deploy Vercel** + domain + `.env` production. (Cần: tài khoản Vercel)

**Xong chặng B = mở điện thoại là xem được kho ảnh, có mật khẩu bảo vệ.**

---

## Định nghĩa HOÀN THÀNH

**Bản dùng local — ĐÃ XONG ✓**
- ✓ Upload ổn định, không sập.
- ✓ Ảnh gốc nằm trên Telegram, ổ cứng chỉ giữ thumbnail nhẹ.
- ✓ Upload → xem → tải gốc → xoá đều đúng.
- ✓ Khởi động 1-click (`start-huacloud.bat`), sao lưu (`npm run backup`), hướng dẫn ([09](09_HUONG_DAN_SU_DUNG.md)).

**Bản deploy — để dành:** xem từ điện thoại qua domain, có đăng nhập. Làm khi Hưng cần.

## Cần Hưng cung cấp

| Việc | Cho chặng | Trạng thái |
|---|---|---|
| Bot Telegram (@HuaCloud_bot) | A | ✓ đã có token |
| Chat lưu ảnh (đã dùng chat riêng với @HuaCloud_bot) | A | ✓ xong |
| Tài khoản Neon (Postgres free) | B | chỉ khi deploy (đã hoãn) |
| Tài khoản Vercel + domain | B | chỉ khi deploy (đã hoãn) |
