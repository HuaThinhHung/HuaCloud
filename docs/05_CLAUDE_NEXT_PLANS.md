# 05 - CLAUDE NEXT PLANS

# HuaCloud - 3 prompt tiếp sức cho Claude Fable 5

> Cách dùng: mở Claude Code trong repo `D:\Dự Án Cá nhân\HuaCloud`, dán từng plan một. Chỉ chuyển sang plan tiếp theo khi plan hiện tại đã build/test được. Mỗi plan được thiết kế để Claude làm trong một phiên riêng, ít bị vỡ context.

---

## Quy tắc bắt buộc cho Claude khi làm các plan này

```text
QUY TẮC LÀM VIỆC BẮT BUỘC:

Bạn không được dừng lại để hỏi lại những việc đã nằm trong plan.
Hãy tự đọc repo, tự đưa ra giả định hợp lý, tự sửa file, tự apply patch, tự cài dependency cần thiết, tự chạy lệnh kiểm tra và tự sửa lỗi phát sinh.

Chủ dự án đã chấp thuận trước cho các thay đổi nằm trong phạm vi plan này, bao gồm:
- chỉnh sửa / tạo / di chuyển file trong repo;
- cập nhật package.json và cấu hình;
- cài dependency cần thiết;
- refactor code cũ thành cấu trúc HuaCloud;
- thay UI, metadata, README, docs theo brand HuaCloud;
- chạy format, lint, typecheck, build, Prisma command và test command;
- tạo abstraction/service/module mới nếu cần để hoàn thành mục tiêu.

Chỉ hỏi lại nếu gặp một trong các trường hợp sau:
- cần secret thật như token Telegram, database URL production, API key AI;
- hành động có nguy cơ xóa dữ liệu thật hoặc chạy destructive command như reset hard, force push, xóa database production;
- có xung đột yêu cầu không thể tự quyết định;
- thiếu thông tin mà không thể tiếp tục bằng mock/local fallback.

Nếu thiếu env thật, hãy dùng `.env.example`, mock driver, local driver hoặc placeholder an toàn để app vẫn build và demo được.
Không được kết thúc phiên bằng lời khuyên chung chung. Phải để lại code chạy được hoặc báo chính xác blocker kỹ thuật.
```

---

## PLAN 1 - Dựng nền HuaCloud Next.js sạch, chạy được

```text
Bạn là Senior Full-stack Engineer đang tiếp tục dự án HuaCloud của Hua Hưng.

QUAN TRỌNG:
- Không hỏi lại các việc đã nằm trong plan này.
- Tự apply thay đổi, tự cài dependency cần thiết, tự chạy kiểm tra, tự sửa lỗi.
- Chỉ hỏi khi cần secret thật hoặc có nguy cơ xóa dữ liệu/command phá hủy.

Trước khi code, hãy đọc các file:
- docs/00_CODEBASE_AUDIT.md
- docs/01_PROJECT_VISION.md
- docs/02_PRODUCT_REQUIREMENTS.md
- docs/03_SYSTEM_ARCHITECTURE.md
- docs/04_DEVELOPMENT_ROADMAP.md

Bối cảnh:
- Repo hiện tại là clone từ Telegraph-Image.
- Mục tiêu không phải sửa giao diện cũ, mà chuyển hóa thành sản phẩm mới tên HuaCloud.
- Code cũ chỉ dùng để tham khảo Telegram upload/storage pattern.
- Không được commit secret thật.
- Không đụng `node_modules`.
- Không xóa `docs/`.

Nhiệm vụ của phiên này:
1. Chuyển nền dự án sang Next.js 15 + TypeScript + TailwindCSS trong root hiện tại.
2. Cập nhật `package.json` thành project HuaCloud:
   - name: `huacloud`
   - scripts tối thiểu: `dev`, `build`, `start`, `lint`, `typecheck`
   - loại bỏ đường chạy chính phụ thuộc Cloudflare/Wrangler cũ.
3. Tạo cấu trúc thư mục chuẩn (theo mục 3 của docs/03_SYSTEM_ARCHITECTURE.md — nguồn chuẩn):
   - `src/app` (route groups: `(marketing)`, `(app)`, `(admin)`, `s/[token]`, `f/[assetId]`, `api/`)
   - `src/features` (upload, gallery, albums, search, share, trash, favorites, settings, ai)
   - `src/components/ui` + `src/components/layout`
   - `src/server/db`, `src/server/services`, `src/server/storage`, `src/server/ai`, `src/server/media`, `src/server/inngest`, `src/server/security`
   - `src/lib` (env.ts, schemas/, utils.ts)
   - `src/types`
   - `prisma/` (schema.prisma + migrations)
4. Tạo UI foundation:
   - dark mode mặc định.
   - layout app shell có sidebar + topbar.
   - landing page ngắn, cao cấp, mang brand HuaCloud.
   - dashboard page có mock assets.
   - upload page có dropzone UI mock.
   - gallery grid mock.
   - settings page skeleton.
5. Tạo brand metadata:
   - title/description Open Graph HuaCloud.
   - favicon placeholder hoặc generated simple brand mark.
   - README mới cho HuaCloud.
   - `.env.example` đầy đủ biến theo docs.
6. Nếu cần giữ file cũ để tham khảo, di chuyển vào `legacy/` hoặc đảm bảo chúng không còn là entrypoint chính.

Yêu cầu chất lượng:
- UI phải khác hoàn toàn repo cũ.
- Không tạo landing page marketing rỗng; màn hình đầu tiên phải cho thấy HuaCloud là product quản lý ảnh.
- Không dùng UI màu tím/xanh đậm một màu nhàm chán. Palette nên premium, dark, trung tính, có accent vừa đủ.
- Component gọn, không nhồi logic.
- TypeScript strict nhất có thể.
- Không dùng any bừa bãi.
- Responsive desktop/mobile.

Sau khi code xong, chạy:
- npm install nếu dependency thay đổi
- npm run typecheck
- npm run lint
- npm run build

Nếu command nào fail, sửa đến khi pass hoặc ghi rõ lý do bị chặn.

Kết quả cuối phiên cần có:
- App HuaCloud chạy được bằng `npm run dev`.
- `npm run build` pass.
- README và metadata đã rebrand.
- Không còn dấu vết Telegraph-Image ở UI/README/package chính.
```

---

## PLAN 2 - Làm upload/gallery MVP thật với database và Telegram

```text
Tiếp tục HuaCloud sau PLAN 1. Trước khi code, hãy kiểm tra git status và đọc:

QUAN TRỌNG:
- Không hỏi lại các việc đã nằm trong plan này.
- Tự apply thay đổi, tự cài dependency cần thiết, tự chạy kiểm tra, tự sửa lỗi.
- Nếu thiếu secret Telegram/database thật, tự tạo mock/local fallback để app vẫn chạy được.
- Chỉ hỏi khi cần secret thật hoặc có nguy cơ xóa dữ liệu/command phá hủy.

- docs/02_PRODUCT_REQUIREMENTS.md
- docs/03_SYSTEM_ARCHITECTURE.md
- docs/04_DEVELOPMENT_ROADMAP.md

Mục tiêu phiên này:
Biến dashboard mock thành MVP có dữ liệu thật: upload ảnh, lưu metadata vào database, lưu original vào Telegram qua StorageDriver, rồi hiển thị lại trong gallery.

Phạm vi bắt buộc:
1. Database:
   - Cài Prisma.
   - Tạo `prisma/schema.prisma` ĐẦY ĐỦ theo mục 4 của docs/03_SYSTEM_ARCHITECTURE.md — migration đầu tiên phải có đủ mọi model (ADR-08, không cắt bảng "chưa dùng"):
     - User, Session, Account, Verification (Better Auth)
     - Workspace, WorkspaceMember
     - StorageChannel
     - Asset, StoragePart (variant ORIGINAL|THUMB|PREVIEW, backend TELEGRAM|R2, partIndex)
     - Album, AlbumAsset
     - Share, ApiKey, Activity, UsageEvent
     - kèm SQL tay trong migration: cột `embedding vector(768)` + HNSW, tsvector + GIN (copy từ 03 mục 4).
   - Tạo Prisma client ở `src/server/db/client.ts`.
   - Tạo seed demo workspace.
2. Service layer:
   - `src/server/services/asset.service.ts`
   - `src/server/services/album.service.ts`
   - `src/server/services/activity.service.ts`
   - UI không được gọi Prisma trực tiếp.
3. Upload:
   - Tạo route/server action upload ảnh.
   - Validate MIME bằng Zod.
   - Validate file size.
   - Tạo Asset status `PROCESSING`.
   - Gọi storage driver.
   - Cập nhật status `READY` hoặc `FAILED`.
4. Telegram (theo mục 5 của docs/03_SYSTEM_ARCHITECTURE.md):
   - Tạo interface `StorageDriver` ở `src/server/storage/types.ts`.
   - Tạo `TelegramDriver` ở `src/server/storage/telegram/` (client.ts + driver.ts + path-cache.ts).
   - Đóng gói Telegram methods:
     - `sendDocument` (KHÔNG dùng sendPhoto — giữ nguyên bytes)
     - `getFile` (cache `tgFilePath` TTL ~50 phút trong StoragePart)
     - `deleteMessage` (lưu `tgMessageId` lúc upload để xóa thật được).
   - Chặn cứng 20MB/file (Zod cả client lẫn server).
   - Có retry/backoff đơn giản.
   - Có error class rõ ràng khi token/chat/env sai.
   - Không để component biết Telegram tồn tại.
5. Gallery:
   - Đọc asset từ DB.
   - Có grid view.
   - Có detail drawer/modal.
   - Có trạng thái PROCESSING/READY/FAILED.
   - Có soft delete hoặc delete MVP.
   - Có favorite MVP nếu kịp.
6. Environment:
   - `.env.example` cập nhật đúng.
   - Không ghi token thật vào repo.

Nếu Telegram thật chưa cấu hình được:
- vẫn phải implement driver thật theo env.
- thêm `LocalStorageDriver` hoặc `MockStorageDriver` cho dev bằng `STORAGE_DRIVER=local`.
- App vẫn phải demo được không cần secret thật.

Yêu cầu chất lượng:
- Request upload không được làm crash toàn app khi Telegram lỗi.
- Error message người dùng dễ hiểu.
- Không block UI vô hạn.
- Không viết logic upload lẫn trong React component.
- Không lưu raw secret/token trong database.
- Không bỏ qua validation.

Sau khi code xong, chạy:
- npm run typecheck
- npm run lint
- npm run build
- npx prisma validate

Nếu có database local và env sẵn, chạy thêm:
- npx prisma migrate dev
- npx prisma db seed nếu đã tạo seed

Kết quả cuối phiên cần có:
- Upload ảnh từ UI hoạt động ở local/mock driver.
- Khi cấu hình Telegram env, upload original lên Telegram qua driver.
- Gallery refresh vẫn thấy asset từ DB.
- Codebase có nền vững để thêm thumbnail/AI.
```

---

## PLAN 3 - Nâng cấp sản phẩm: thumbnail, AI metadata, search, share, production polish

```text
Tiếp tục HuaCloud sau PLAN 1 và PLAN 2. Trước khi code, hãy đọc:

QUAN TRỌNG:
- Không hỏi lại các việc đã nằm trong plan này.
- Tự apply thay đổi, tự cài dependency cần thiết, tự chạy kiểm tra, tự sửa lỗi.
- Nếu thiếu env R2/AI thật, tự tạo local/mock fallback để app vẫn build và demo được.
- Chỉ hỏi khi cần secret thật hoặc có nguy cơ xóa dữ liệu/command phá hủy.

- docs/02_PRODUCT_REQUIREMENTS.md
- docs/03_SYSTEM_ARCHITECTURE.md
- docs/04_DEVELOPMENT_ROADMAP.md

Mục tiêu phiên này:
Nâng HuaCloud từ MVP upload/gallery thành sản phẩm DAM có cảm giác cao cấp: thumbnail nhanh, AI metadata, search tự nhiên, share link và polish production.

Làm theo thứ tự ưu tiên, không ôm quá rộng nếu build chưa pass.

PHẦN A - Image derivatives:
1. Cài và cấu hình Sharp.
2. Sau upload, tạo:
   - thumbnail 320px WebP.
   - preview 1024px WebP.
   - width/height.
   - blur placeholder.
3. Tạo abstraction cho derivative storage:
   - local dev driver.
   - R2 driver nếu env có.
4. Gallery phải dùng thumbnail/preview, không dùng original nặng cho grid.

PHẦN B - AI enrichment:
1. Tạo module `src/server/ai` (enrich.ts + embedding.ts + prompts.ts; Zod schema ở `src/lib/schemas/ai.ts`) theo mục 8 của docs/03_SYSTEM_ARCHITECTURE.md.
2. Dùng Vercel AI SDK (`generateObject` + Zod schema, provider Gemini qua env), không hardcode vendor sâu trong UI.
3. Sau upload hoặc qua action riêng, sinh:
   - caption tiếng Việt.
   - tags.
   - OCR text nếu có.
   - objects mô tả.
   - color palette.
4. Lưu vào DB.
5. UI detail drawer hiển thị AI metadata đẹp, gọn.
6. AI lỗi/quota hết không được làm asset upload fail.

PHẦN C - Search:
1. Tạo search box thật trên topbar/library.
2. Search theo:
   - filename.
   - caption.
   - tags.
   - OCR.
   - album.
3. Chuẩn bị schema/code để sau này thêm vector search, nhưng không làm quá mức nếu chưa cần.
4. Có empty state đẹp khi không có kết quả.

PHẦN D - Sharing:
1. Tạo public share link:
   - token ngẫu nhiên.
   - optional expiration.
   - optional password nếu kịp.
2. Tạo route `/s/[token]`.
3. Public page không lộ thông tin nội bộ/Telegram.
4. Có revoke share trong UI.

PHẦN E - Production polish:
1. Scan toàn repo để xóa dấu vết Telegraph-Image khỏi code chính:
   - README.
   - package metadata.
   - UI text.
   - SEO.
   - comments không cần thiết.
2. Cập nhật docs setup:
   - local development.
   - Telegram bot setup.
   - database setup.
   - R2 optional.
   - AI optional.
3. Thêm health/status page hoặc settings diagnostics:
   - database connected.
   - storage driver status.
   - AI key configured.
4. Bổ sung test tối thiểu cho:
   - env validation.
   - storage driver mock.
   - upload validation.
   - asset service.

Yêu cầu chất lượng:
- Build phải pass.
- UI không bị lệch trên mobile.
- Không có text quá dài trong card/button.
- Không để ảnh vỡ layout khi ảnh ngang/dọc khác nhau.
- Không để Telegram xuất hiện trong trải nghiệm người dùng, trừ trang settings diagnostics dành cho owner.
- Không commit secret.

Sau khi code xong, chạy:
- npm run typecheck
- npm run lint
- npm run build
- test command hiện có nếu đã cấu hình

Kết quả cuối phiên cần có:
- Upload xong có thumbnail/preview.
- Gallery nhanh và đẹp hơn.
- Asset có AI caption/tag/OCR nếu env AI sẵn.
- Search hoạt động.
- Share link public hoạt động.
- README đủ để người khác clone và chạy.
```

---

## Prompt ngắn để Claude tự kiểm tra cuối mỗi phiên

```text
Trước khi kết thúc, hãy tự audit:
1. Những file nào đã đổi?
2. Có còn dấu vết Telegraph-Image trong UI/package/README không?
3. Lệnh nào đã chạy và pass/fail?
4. Nếu fail, nguyên nhân cụ thể là gì?
5. Bước tiếp theo tốt nhất là gì?

Trả lời ngắn gọn, có checklist, và không giấu lỗi build/test.
```

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| [00_CODEBASE_AUDIT.md](00_CODEBASE_AUDIT.md) | Khảo sát chi tiết repo gốc — cái gì tham khảo được, cái gì bỏ |
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Tầm nhìn, mục tiêu, yêu cầu thương hiệu HuaCloud |
| [02_PRODUCT_REQUIREMENTS.md](02_PRODUCT_REQUIREMENTS.md) | Chi tiết từng tính năng, user story, acceptance criteria |
| [03_SYSTEM_ARCHITECTURE.md](03_SYSTEM_ARCHITECTURE.md) | Kiến trúc hệ thống, schema, luồng dữ liệu — **nguồn chuẩn khi mâu thuẫn** |
| [04_DEVELOPMENT_ROADMAP.md](04_DEVELOPMENT_ROADMAP.md) | 7 phase (~10–12 tuần), task checkbox, definition of done |
