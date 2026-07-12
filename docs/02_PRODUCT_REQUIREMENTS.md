# 02 — PRODUCT REQUIREMENTS

# HuaCloud — Product Requirements Document (PRD)

| | |
|---|---|
| **Sản phẩm** | HuaCloud |
| **Tác giả / Owner** | Hua Hưng |
| **Phiên bản tài liệu** | 1.0 |
| **Ngày cập nhật** | 2026-07-05 |
| **Bộ tài liệu** | [01 Vision](01_PROJECT_VISION.md) · [02 Product Requirements](02_PRODUCT_REQUIREMENTS.md) · [03 System Architecture](03_SYSTEM_ARCHITECTURE.md) · [04 Development Roadmap](04_DEVELOPMENT_ROADMAP.md) |

> Quy ước priority: **P0** = bắt buộc cho V1, thiếu là không ship. **P1** = quan trọng, làm trong V1 nếu đúng tiến độ. **P2** = có sau V1 (backlog có chủ đích).
> Cột **Phase** tham chiếu roadmap 6+1 phase đã chốt tại [04 Development Roadmap](04_DEVELOPMENT_ROADMAP.md).

---

## 1. Bối cảnh & mục tiêu sản phẩm

HuaCloud là bản rebuild toàn diện từ Telegraph-Image (image host trên Cloudflare Pages, license CC0) thành **nền tảng Digital Asset Management (DAM) tích hợp AI**, mang thương hiệu HuaCloud. Repo gốc chỉ là tham khảo kỹ thuật — đặc biệt lớp tích hợp Telegram Bot API; không giữ lại UI, cấu trúc hay branding cũ.

Điểm khác biệt cốt lõi: Telegram là **storage backend ẩn hoàn toàn** (chỉ lưu file ORIGINAL), derivatives (thumb/preview) nằm trên Cloudflare R2 sau CDN, metadata nằm trên PostgreSQL (Neon) — người dùng chỉ thấy một sản phẩm hiện đại ngang Google Photos / Cloudinary. Lớp AI (Gemini 2.5 Flash qua Vercel AI SDK) sinh caption tiếng Việt, tags, OCR, màu chủ đạo và embedding để tìm kiếm bằng ngôn ngữ tự nhiên.

Mục tiêu V1: sản phẩm production-ready mà một solo developer (Hưng) tự dùng thật hằng ngày sau Phase 1, demo được cho người khác sau Phase 4-5, chi phí vận hành MVP **$0** (Vercel + Neon + Inngest + R2 free tier), và schema/kiến trúc sẵn sàng mở thành SaaS multi-workspace mà không phải đập lại.

---

## 2. Personas

### Persona 1 — Hưng (Owner / Power User / Solo Dev)

- **Bối cảnh:** Developer kiêm technical marketer, quản lý hàng nghìn ảnh sản phẩm, lookbook, banner cho công việc; hiện đang dùng Telegraph-Image cũ nhưng bí tính năng (không album, không search, admin sơ sài, xóa không xóa thật).
- **Nhu cầu:** upload nhanh hàng loạt (kéo thả cả thư mục, Ctrl+V từ clipboard), tổ chức theo album/favorites, tìm lại ảnh bằng mô tả ("ảnh áo polo xanh trên nền beige"), copy link CDN dán vào web/social, và tin rằng dữ liệu không mất (backup/export).
- **Tiêu chí thành công:** thao tác hằng ngày < 3 click; gallery 10.000 ảnh vẫn mượt; toàn quyền admin; tự host được khi cần (đường thoát Docker ở Phase 6).

### Persona 2 — Thành viên team nhỏ (Member được mời vào Workspace)

- **Bối cảnh:** Designer/content trong team ≤ 5 người, được Hưng mời vào workspace chung (tính năng invite là P2, UI V1 chỉ có 1 workspace mặc định nhưng schema đã multi-tenant).
- **Nhu cầu:** đăng nhập đơn giản, upload và duyệt asset của workspace, tạo share link gửi khách, không cần (và không được) đụng cấu hình hệ thống.
- **Tiêu chí thành công:** không cần đào tạo vẫn dùng được; role `MEMBER` không xóa vĩnh viễn được asset của người khác, không thấy trang Admin.

### Persona 3 — Developer tích hợp qua API

- **Bối cảnh:** Chính Hưng (hoặc người dùng kỹ thuật sau này) muốn upload ảnh từ script n8n / CI / app khác — như cách đang dùng endpoint `POST /upload` của repo cũ.
- **Nhu cầu:** REST API có API key, endpoint upload tương thích tối thiểu với format cũ (`[{src}]`) để migrate script không đau, docs rõ ràng, rate limit dự đoán được, scope giới hạn quyền.
- **Tiêu chí thành công:** đổi script cũ sang HuaCloud chỉ cần đổi URL + thêm header `Authorization: Bearer <key>`; lỗi trả về JSON có mã lỗi rõ ràng.

---

## 3. Sơ đồ thông tin — 12 khu vực UI

| # | Khu vực | Route | Vai trò |
|---|---------|-------|---------|
| 1 | **Landing** | `/` | Trang marketing công khai duy nhất: giới thiệu sản phẩm, tính năng, CTA đăng ký/đăng nhập. SEO-first, dark mode mặc định, phong cách Apple/Linear. Không lộ bất kỳ dấu vết Telegraph-Image. |
| 2 | **Dashboard** | `/dashboard` | Màn hình đầu tiên sau đăng nhập: số liệu nhanh (tổng asset, dung lượng, upload gần đây, job đang xử lý), quick actions (upload, tạo album), asset mới nhất. |
| 3 | **Upload** | `/upload` (+ global dropzone) | Điểm vào upload chính: drag-drop, chọn file/thư mục, paste Ctrl+V. Hiển thị hàng đợi, progress từng file, trạng thái PROCESSING/READY/FAILED, nút retry. Dropzone toàn cục hoạt động ở mọi trang trong app. |
| 4 | **Gallery** | `/gallery` | Trái tim sản phẩm: duyệt toàn bộ asset với 4 chế độ xem (grid/masonry/list/timeline), virtualized infinite scroll, blur placeholder thumbhash, multi-select + batch ops, lightbox xem chi tiết + panel metadata/AI. |
| 5 | **Albums** | `/albums`, `/albums/[id]` | Danh sách album + trang chi tiết album: CRUD, đặt ảnh bìa, kéo-thả sắp xếp, thêm/bớt asset. Smart album (điều kiện tự động) xuất hiện ở Phase 5. |
| 6 | **Search** | `/search?q=` | Tìm kiếm hợp nhất: filename, full-text (caption/tags/OCR), natural language qua embedding, filter theo loại/màu/ngày, "tìm ảnh tương tự". Kết quả dùng chung component grid với Gallery. |
| 7 | **Favorites** | `/favorites` | View lọc `isFavorite = true` — thay thế tính năng `liked` của repo cũ. Toggle bằng phím tắt `F` hoặc icon trên card/lightbox. |
| 8 | **Shared** | `/shared` | Quản lý mọi share link đã tạo: trạng thái (active/expired/revoked), lượt xem/lượt tải, sửa password/expiry, revoke. Trang public cho người nhận là `/s/[token]` (ngoài auth). |
| 9 | **Trash** | `/trash` | Asset đã soft-delete (`deletedAt != null`), giữ 30 ngày; restore hoặc xóa vĩnh viễn (xóa thật trên Telegram qua `deleteMessage`). Hiển thị đếm ngược ngày purge. |
| 10 | **Analytics** | `/analytics` | Thống kê workspace: dung lượng theo thời gian, số upload theo ngày, top asset được xem/tải qua share, tổng hợp từ bảng `Activity` + `UsageEvent`. |
| 11 | **Settings** | `/settings` | Hồ sơ cá nhân, đổi mật khẩu, theme, ngôn ngữ (vi/en), quản lý API key, cấu hình workspace (tên, mặc định share), khu vực Export/Backup. |
| 12 | **Admin** | `/admin` | Chỉ role OWNER: quản lý user/member, audit log viewer (bảng `Activity`), sức khỏe hệ thống (job Inngest failed, StorageChannel), reprocess asset, moderation (block asset). |

---

## 4. Yêu cầu chi tiết theo nhóm

### 4a. Upload

Kiến trúc nền (chi tiết ở [03 System Architecture](03_SYSTEM_ARCHITECTURE.md)): client upload thẳng lên **Vercel Blob** (staging, né giới hạn 4.5MB body serverless) → tạo `Asset` status `PENDING` → Inngest function `process-asset` (throttle theo kênh Telegram, retry backoff) đẩy ORIGINAL lên Telegram bằng `sendDocument`, sinh derivatives lên R2, xóa file staging.

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| UP-01 | Là người dùng, tôi muốn kéo-thả một hoặc nhiều file vào bất kỳ trang nào trong app để upload mà không cần mở trang Upload. | P0 | 1 (global dropzone: 2) |
| UP-02 | Là người dùng, tôi muốn upload nhiều file cùng lúc với progress bar riêng từng file để biết file nào xong, file nào lỗi. | P0 | 1 |
| UP-03 | Là người dùng, tôi muốn dán ảnh từ clipboard bằng Ctrl+V (screenshot, ảnh copy từ web) để upload nhanh nhất có thể. | P0 | 2 |
| UP-04 | Là người dùng, tôi muốn kéo-thả cả một thư mục (kể cả thư mục lồng nhau) để upload hàng loạt ảnh đã tổ chức sẵn. | P1 | 2 |
| UP-05 | Là người dùng, tôi muốn thấy preview thumbnail của file ngay trong hàng đợi trước khi upload xong để xác nhận đúng file. | P1 | 1 |
| UP-06 | Là người dùng, tôi muốn file lỗi được tự retry, và tự bấm "Thử lại" khi hết retry, để không phải upload lại từ đầu cả lô. | P0 | 1 |
| UP-07 | Là người dùng, tôi muốn được báo rõ ràng ngay khi chọn file > 20MB để không chờ đợi vô ích. | P0 | 1 |
| UP-08 | Là người dùng, tôi muốn hệ thống nhận diện file trùng (đã upload trước đó) để tránh lưu 2 bản giống hệt. | P1 | 3 |

**Acceptance criteria:**

- **UP-01:** Kéo file vào viewport hiện overlay dropzone ≤ 100ms; thả file bắt đầu upload ngay; hỗ trợ đồng thời tối thiểu 50 file/lượt thả (xếp hàng client-side, 3-5 file upload song song).
- **UP-02:** Mỗi file có progress % thật (từ Blob client upload) + trạng thái hiển thị `Đang tải lên → Đang xử lý → Sẵn sàng / Lỗi` (map enum: client đang đẩy lên Blob → `PENDING` → `PROCESSING` → `READY`/`FAILED`); asset ở `PENDING`/`PROCESSING` hiển thị trong Gallery với badge, tự chuyển `READY` không cần reload (React Query polling khi có asset đang xử lý).
- **UP-03:** `document paste` listener hoạt động trên mọi trang trong `(app)` layout; ảnh paste được đặt tên `pasted-{timestamp}.png`; paste nhiều ảnh trong 1 clipboard đều được nhận.
- **UP-04:** Dùng `webkitGetAsEntry()` duyệt cây thư mục; đường dẫn tương đối của file được giữ trong metadata upload (làm cơ sở gợi ý tạo album theo tên thư mục — gợi ý là P2).
- **UP-06:** Inngest retry 4 lần (exponential backoff); lỗi 429 Telegram tôn trọng `retry_after`; quá 4 lần → `Asset.status = FAILED` + ghi `Activity`; UI Upload/Gallery hiện nút "Thử lại" gửi lại event `asset/uploaded`; file staging trên Blob chưa bị xóa khi asset chưa `READY`/`FAILED`-purge nên retry không cần upload lại từ client.
- **UP-07:** Chặn cứng 20MB/file ở **cả hai phía**: client (validate trước khi gửi, toast lỗi nêu rõ "Giới hạn hiện tại là 20MB/file") và server (Zod trong `handleUpload` của route `/api/upload`); file quá hạn không tạo record `Asset`; thông báo không mơ hồ kiểu "upload failed". *(Lý do 20MB: Bot API `getFile` chỉ tải về được ≤ 20MB — schema `StoragePart.partIndex` đã sẵn cho chunking sau V1; xem [03](03_SYSTEM_ARCHITECTURE.md).)*
- **UP-08:** So `checksumSha256` trong cùng workspace (`@@index([workspaceId, checksumSha256])`); nếu trùng, hỏi người dùng "Bỏ qua / Vẫn tải lên"; không tự động silent-skip.

> **Ghi chú resume:** V1 KHÔNG có resumable upload byte-level (tus). "Resume" trong V1 = hàng đợi client giữ danh sách file chưa xong, tự chạy tiếp file kế khi 1 file lỗi, và retry server-side như UP-06. Resumable protocol thật nằm ở backlog (mục 7).

### 4b. Gallery & duyệt

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| GA-01 | Là người dùng, tôi muốn duyệt toàn bộ asset dạng grid với infinite scroll mượt để xem thư viện hàng chục nghìn ảnh. | P0 | 2 |
| GA-02 | Là người dùng, tôi muốn chuyển đổi 4 chế độ xem grid / masonry / list / timeline để duyệt theo thói quen từng lúc. | P1 | 2 |
| GA-03 | Là người dùng, tôi muốn thấy blur placeholder ngay lập tức thay vì ô trắng khi ảnh đang tải để gallery không bao giờ "nhấp nháy". | P0 | 3 |
| GA-04 | Là người dùng, tôi muốn click ảnh mở lightbox điều hướng bằng phím mũi tên, xem metadata + kết quả AI, và copy link. | P0 | 2 |
| GA-05 | Là người dùng, tôi muốn multi-select (click + Shift/Ctrl, kéo chọn vùng) để thao tác hàng loạt. | P0 | 2 |
| GA-06 | Là người dùng, tôi muốn batch operations trên selection: thêm vào album, favorite, tải về, xóa (vào Trash), copy links. | P0 | 2 |
| GA-07 | Là người dùng, tôi muốn lọc nhanh theo loại file (ảnh/video/audio/tài liệu) và sắp xếp theo ngày/tên/kích thước. | P1 | 2 |

**Acceptance criteria:**

- **GA-01:** Virtualization bằng `@tanstack/react-virtual`; DOM chỉ chứa item trong + quanh viewport; cuộn 10.000 asset không rớt khung hình rõ rệt (mục tiêu 60fps, xem mục 5); phân trang cursor-based từ Postgres (`@@index([workspaceId, deletedAt, createdAt])`).
- **GA-02 (điểm KHÔNG THƯƠNG LƯỢNG):** thumbnail của **mọi** chế độ xem serve từ **R2 qua Cloudflare CDN** — gallery không bao giờ phát request tới Telegram. Timeline nhóm theo `takenAt` (EXIF, fallback `createdAt`) với header tháng/năm sticky. Chế độ xem + sort được nhớ (URL param qua `nuqs` + localStorage).
- **GA-03:** `Asset.thumbhash` (~28 bytes, cột Postgres) trả kèm ngay trong payload list; client decode thành data-URL đồng bộ khi render — placeholder xuất hiện cùng frame với layout, ảnh thật fade-in đè lên.
- **GA-04:** Lightbox: `←`/`→` điều hướng, `Esc` đóng, `F` favorite, `Del` xóa; panel info hiển thị fileName, kích thước, mime, thời gian, EXIF (`takenAt`, camera), palette màu, `aiCaption`, `aiTags`, `ocrText` (nếu có); nút "Copy link" (link app), "Copy direct URL" (`/f/[assetId]` — kèm chữ ký nếu asset nằm trong share), "Tải bản gốc", "Tìm ảnh tương tự" (Phase 5).
- **GA-05:** `Ctrl/Cmd+Click` toggle, `Shift+Click` chọn dải, `Ctrl+A` chọn toàn bộ kết quả đã tải, `Esc` bỏ chọn; thanh action nổi hiển thị số item đang chọn.
- **GA-06:** Batch delete = soft delete (vào Trash) + confirm 1 lần cho cả lô; batch download: ≤ 10 file tải tuần tự trình duyệt, > 10 file trả zip stream (P1); mọi batch mutation ghi `Activity` 1 record/hành động kèm danh sách `targetId`.

### 4c. Tổ chức (Albums, Favorites, Trash, Rename)

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| OR-01 | Là người dùng, tôi muốn tạo album, đặt tên/mô tả/ảnh bìa và thêm asset vào để tổ chức thư viện theo dự án. | P0 | 2 |
| OR-02 | Là người dùng, tôi muốn kéo-thả asset vào album (từ gallery vào sidebar/album) và sắp xếp thứ tự trong album. | P1 | 2 |
| OR-03 | Là người dùng, tôi muốn đánh dấu favorite bằng 1 phím/click và xem lại tất cả trong trang Favorites. | P0 | 2 |
| OR-04 | Là người dùng, tôi muốn đổi tên hiển thị của asset để dễ tìm kiếm về sau. | P0 | 2 |
| OR-05 | Là người dùng, tôi muốn asset xóa đi nằm trong Trash 30 ngày và restore được, để không mất dữ liệu vì lỡ tay. | P0 | 2 |
| OR-06 | Là người dùng, tôi muốn xóa vĩnh viễn asset trong Trash (hoặc "Dọn sạch Trash") và biết chắc file trên storage cũng bị xóa thật. | P0 | 2 |
| OR-07 | Là người dùng, tôi muốn tạo smart album theo điều kiện (tag, từ khóa, khoảng ngày, màu) tự cập nhật khi có asset mới khớp. | P1 | 5 |

**Acceptance criteria:**

- **OR-01:** Model `Album` + `AlbumAsset` (`@@id([albumId, assetId])`, có `position`); 1 asset thuộc nhiều album; xóa album KHÔNG xóa asset; `coverAssetId` chọn tay hoặc mặc định asset mới nhất.
- **OR-03:** Toggle `Asset.isFavorite` là optimistic update (React Query) — UI đổi ngay, rollback nếu server lỗi; phím tắt `F` hoạt động ở card đang hover và trong lightbox.
- **OR-04:** Rename đổi `Asset.fileName` (giới hạn 255 ký tự, Zod), giữ nguyên extension gợi ý; ghi `Activity` action `asset.rename`. *(Sửa dứt điểm bug repo cũ: `editName` đọc `params.name` luôn `undefined` — HuaCloud nhận tên mới qua request body của Server Action, validate Zod.)*
- **OR-05:** Soft delete set `Asset.deletedAt`; asset biến mất khỏi Gallery/Search/Album view (mọi query mặc định `deletedAt IS NULL`); Trash hiển thị số ngày còn lại (30 − đã trôi).
- **OR-06:** Xóa vĩnh viễn: Inngest gọi `deleteMessage(tgChatId, tgMessageId)` cho từng `StoragePart`, xóa object R2 (thumb/preview), rồi xóa row DB; cron `purge-trash` chạy hằng ngày purge asset quá 30 ngày; nếu `deleteMessage` fail (message đã mất) vẫn xóa DB nhưng ghi `Activity` cảnh báo. *(Repo cũ "delete" chỉ xóa record KV, file sống vĩnh viễn trên Telegram — HuaCloud xóa thật được nhờ lưu `tgMessageId`.)*
- **OR-07:** `Album.isSmart = true` + `smartQuery Json` (ví dụ `{q: "hóa đơn", tags: [], dateRange: {...}, colors: []}`); mở album = chạy lại search service, không materialize danh sách.

### 4d. Chia sẻ

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| SH-01 | Là người dùng, tôi muốn tạo link chia sẻ công khai cho 1 asset hoặc 1 album để gửi cho người không có tài khoản. | P0 | 4 |
| SH-02 | Là người dùng, tôi muốn đặt mật khẩu cho share link để chỉ người biết mật khẩu xem được. | P0 | 4 |
| SH-03 | Là người dùng, tôi muốn đặt thời hạn (expiry) và giới hạn lượt tải (max download) cho link. | P0 | 4 |
| SH-04 | Là người dùng, tôi muốn lấy QR code của link để chia sẻ nhanh qua màn hình/in ấn. | P1 | 4 |
| SH-05 | Là người dùng, tôi muốn revoke link bất kỳ lúc nào và link chết ngay lập tức. | P0 | 4 |
| SH-06 | Là người dùng, tôi muốn xem thống kê lượt xem/lượt tải của từng link trong trang Shared. | P1 | 4 |

**Acceptance criteria:**

- **SH-01:** Model `Share` (token nanoid 12 ký tự, unique; `assetId` hoặc `albumId`); trang public `/s/[token]` render ngoài auth, responsive, có nút tải (nếu `allowDownload`), branding HuaCloud; asset trong share album hiển thị bằng grid thumbnail từ R2. Trang `/s/[token]` có OG tags (preview đẹp khi dán vào chat).
- **SH-02:** `passwordHash` (bcrypt/argon2); nhập sai 5 lần liên tiếp/IP → chặn 15 phút (rate limit); mật khẩu không bao giờ xuất hiện trong URL.
- **SH-03:** `expiresAt` quá hạn → trang `/s/[token]` trả trạng thái "Link đã hết hạn" (HTTP 410); `maxDownloads` đạt trần → chặn nút tải, viewer vẫn xem được (quy ước V1); `downloadCount`/`viewCount` tăng nguyên tử.
- **SH-04:** QR sinh client-side bằng package `qrcode`, tải về PNG; không gọi dịch vụ QR bên thứ ba.
- **SH-05:** `revokedAt != null` → `/s/[token]` trả 410 ngay (kiểm tra DB mỗi request page); file URL đã ký cấp cho share đó hết hiệu lực khi `exp` trong chữ ký hết hạn (TTL chữ ký ngắn, mặc định ≤ 1h) — chấp nhận độ trễ tối đa bằng TTL cho CDN cache.
- **Serve file share (nền tảng):** file trong share dùng **signed URL HMAC-SHA256** dạng `/f/[assetId]?sig=&exp=` để Cloudflare CDN cache được mà không hit auth; asset private (ngoài share) chỉ serve qua session của workspace member. Bot token không bao giờ xuất hiện trong bất kỳ URL nào trả về client.

### 4e. Tìm kiếm

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| SE-01 | Là người dùng, tôi muốn tìm theo tên file (kể cả gõ thiếu dấu/一 phần tên) và thấy kết quả tức thì. | P0 | 2 |
| SE-02 | Là người dùng, tôi muốn full-text search trên caption/tags/OCR để tìm ảnh theo nội dung chữ trong ảnh. | P0 | 5 |
| SE-03 | Là người dùng, tôi muốn tìm bằng ngôn ngữ tự nhiên ("tìm ảnh áo xanh", "hóa đơn tháng 6") và nhận kết quả đúng ngữ nghĩa. | P0 | 5 |
| SE-04 | Là người dùng, tôi muốn filter theo màu chủ đạo, loại file, khoảng ngày — kết hợp được với từ khóa. | P1 | 5 |
| SE-05 | Là người dùng, tôi muốn bấm "Tìm ảnh tương tự" trên một ảnh để tìm các ảnh cùng chủ đề/nội dung. | P1 | 5 |
| SE-06 | Là người dùng, tôi muốn mở search từ mọi nơi bằng Command-K (command palette). | P1 | 2 |

**Acceptance criteria:**

- **SE-01:** Phase 2: `ILIKE`/`pg_trgm` trên `fileName` (unaccent để gõ không dấu vẫn khớp); debounce 300ms; kết quả scope theo `workspaceId` + `deletedAt IS NULL`.
- **SE-02:** Generated column `search_tsv` (tsvector từ `fileName + aiCaption + ocrText + aiTags`, config `simple` + `unaccent`) + GIN index, tạo bằng raw SQL commit trong `prisma/migrations`.
- **SE-03:** Hybrid search: (a) FTS trên `search_tsv`, (b) embed query bằng `gemini-embedding-001` (768d) → pgvector `ORDER BY embedding <=> $qvec LIMIT 50` (HNSW index); merge 2 danh sách bằng **Reciprocal Rank Fusion**; cụm thời gian ("tháng 6", "tuần trước") parse bằng regex/chrono-node thành filter `takenAt`/`createdAt` TRƯỚC khi rank — **không** gọi LLM trong đường search. Câu "tìm ảnh áo xanh" trả về asset có caption/tags liên quan trong top 10 (kiểm bằng bộ ảnh test).
- **SE-04:** Filter màu match `dominantColor`/`palette` theo khoảng cách màu (Δ trong không gian RGB/LAB đơn giản); filter là URL param — share được link kết quả tìm kiếm nội bộ.
- **SE-05:** `ORDER BY embedding <=> (SELECT embedding FROM "Asset" WHERE id = $1) LIMIT 30` — similarity theo ngữ nghĩa mô tả (caption/tags), chấp nhận ở V1; CLIP cross-modal là nâng cấp tương lai (mục 7).
- **Degrade khi tắt AI:** không có embedding → SE-03/SE-05 ẩn khỏi UI, search rơi về SE-01+SE-02 (SE-02 vẫn chạy trên fileName + ocrText nếu từng có); thanh search hiển thị hint "Tìm theo tên file" thay vì "Tìm bằng AI".

### 4f. AI enrichment

Chạy trong Inngest step sau khi asset READY. **1 call multimodal duy nhất** (Gemini 2.5 Flash qua Vercel AI SDK `generateObject` + Zod schema) trên **preview 1024px** (không gửi original) trả về JSON: `{caption (tiếng Việt), tags[] (10-15), ocrText, objects[], colors[], category, isDocument}`.

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| AI-01 | Là người dùng, tôi muốn mỗi ảnh tự có caption tiếng Việt và tags sau khi upload để không phải gắn tay. | P0 | 5 |
| AI-02 | Là người dùng, tôi muốn chữ trong ảnh (hóa đơn, screenshot, slide) được OCR để tìm lại bằng nội dung chữ. | P0 | 5 |
| AI-03 | Là người dùng, tôi muốn ảnh được phân tích màu chủ đạo/palette để lọc theo màu. | P1 | 3 (Sharp) + 5 (AI colors) |
| AI-04 | Là người dùng, tôi muốn sửa/xóa caption và tags do AI sinh ra khi nó sai. | P1 | 5 |
| AI-05 | Là owner, tôi muốn app hoạt động đầy đủ như một DAM thuần khi không cấu hình AI key, để AI là tăng cường chứ không phải phụ thuộc. | P0 | 5 |
| AI-06 | Là owner, tôi muốn reprocess AI cho asset cũ (sau khi bật key / nâng model) từ trang Admin. | P1 | 6 |

**Acceptance criteria:**

- **AI-01:** Ghi `aiCaption`, `aiTags[]` vào `Asset`; sau đó step embedding ghép chuỗi `caption + tags + ocrText + fileName` → `gemini-embedding-001` 768d → `UPDATE "Asset" SET embedding = $1` (raw SQL); asset hiển thị badge AI trong lightbox. Pipeline throttle riêng theo quota Gemini (RPM), fail không chặn asset READY — AI enrich là bước hậu kỳ.
- **AI-02:** `ocrText` được index vào `search_tsv`; ảnh hóa đơn mẫu tìm được bằng số tiền/tên cửa hàng trong ảnh.
- **AI-05 (degrade gracefully):** thiếu env `GEMINI_API_KEY` → Inngest bỏ qua step AI + embedding, không lỗi, không retry vô nghĩa; toàn bộ UI liên quan AI (badge, caption panel, natural search, similar) ẩn; upload/gallery/album/share/trash hoạt động 100%.
- **AI-04:** Sửa caption/tags ghi đè giá trị; hệ thống re-embed sau khi sửa để search khớp nội dung mới; ghi `Activity` action `asset.ai_edit`.
- **AI-06:** Nút "Reprocess AI" (per-asset và batch theo filter) gửi event `asset/reprocess`; idempotent — chạy lại không tạo bản ghi trùng.

### 4g. Xử lý ảnh

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| IM-01 | Là người dùng, tôi muốn hệ thống tự sinh thumbnail và preview tối ưu để gallery tải nhanh trên mọi mạng. | P0 | 1 (thumb cơ bản) + 3 (pipeline đầy đủ) |
| IM-02 | Là người dùng, tôi muốn blur placeholder (thumbhash) cho mọi ảnh để trải nghiệm tải mượt. | P0 | 3 |
| IM-03 | Là người dùng, tôi muốn EXIF (ngày chụp, camera) được đọc tự động để timeline và search theo ngày đúng. | P1 | 3 |
| IM-04 | Là developer, tôi muốn resize on-demand qua URL với preset width cố định để dùng ảnh responsive trên web ngoài. | P1 | 6 |
| IM-05 | Là người dùng, tôi muốn crop / rotate / watermark ảnh trong app. | P2 | Backlog |

**Acceptance criteria:**

- **IM-01:** Sharp chạy trong Inngest function (Node runtime): THUMB **320px WebP q72** + PREVIEW **1024px WebP** → upload **R2** (`StoragePart` backend `R2`); ORIGINAL giữ nguyên 100% bytes trên Telegram (`sendDocument`, không bao giờ `sendPhoto` để tránh Telegram nén lại); derivatives mất được → regenerate từ original bất kỳ lúc nào. Thumb trung bình ≤ 30KB (đo trên bộ ảnh test ≥ 100 ảnh).
- **IM-02:** thumbhash sinh từ bản thu nhỏ ~100px, lưu cột `Asset.thumbhash` (~28 bytes); backfill job cho asset upload trước Phase 3.
- **IM-03:** Đọc EXIF trước khi original lên Telegram: `takenAt`, orientation (auto-rotate derivatives), camera model vào `aiMeta`; tùy chọn strip GPS khi share công khai (P2).
- **IM-04:** Route `GET /f/[assetId]/w/[width]` chỉ chấp nhận **whitelist preset** `[320, 640, 1024, 1600, 2048]` — width ngoài whitelist trả 400 (chống abuse đốt CPU); kết quả set `Cache-Control: public, max-age=31536000, immutable` để CDN gánh, chỉ resize lần đầu.
- **IM-05:** Không cam kết V1; khi làm sẽ transform trên PREVIEW/ORIGINAL và lưu thành asset mới (không ghi đè gốc).
- **Serve original (nền tảng):** `GET /f/[assetId]` proxy Telegram với `tgFilePath` cache ~50 phút trong DB (`tgFilePath`, `tgFilePathAt`) + retry đúng 1 lần bằng `getFile` mới khi Telegram trả 404; response `Cache-Control` immutable. *(Repo cũ gọi `getFile` 2 round-trip cho MỖI lượt xem, không cache gì — đây là fix trọng tâm.)*

### 4h. API công khai + API key

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| AP-01 | Là developer, tôi muốn tạo API key theo workspace, xem prefix, revoke được, để tích hợp script bên ngoài an toàn. | P0 | 4 |
| AP-02 | Là developer, tôi muốn endpoint upload `POST /api/v1/upload` tương thích tối thiểu format cũ `[{src}]` để migrate script hiện có chỉ bằng đổi URL + thêm key. | P0 | 4 |
| AP-03 | Là developer, tôi muốn API key có scopes giới hạn quyền (chỉ upload, chỉ đọc) để key lộ ra không phá được dữ liệu. | P0 | 4 |
| AP-04 | Là developer, tôi muốn rate limit rõ ràng, trả header chuẩn, để client tự điều tiết. | P0 | 4 |
| AP-05 | Là developer, tôi muốn các endpoint đọc cơ bản (`GET /api/v1/assets`, `GET /api/v1/assets/:id`) để đồng bộ dữ liệu ra hệ thống khác. | P1 | 6 |

**Acceptance criteria:**

- **AP-01:** Model `ApiKey`: key hiển thị đúng 1 lần lúc tạo, DB chỉ lưu `hashedKey` (SHA-256) + `prefix` (8 ký tự đầu để nhận diện); `lastUsedAt` cập nhật; revoke có hiệu lực ngay (check DB mỗi request).
- **AP-02:** `POST /api/v1/upload` — header `Authorization: Bearer hc_...`, multipart field `file`; **response 200: `[{"src": "/f/{assetId}"}]`** (giữ shape mảng-object-src của repo cũ, path đổi từ `/file/...` sang `/f/...`); lỗi trả JSON `{error: {code, message}}` với HTTP status đúng (400 validate, 401 key sai, 413 quá 20MB, 429 rate limit); server-side upload qua API cũng đi qua staging + Inngest như UI (response trả ngay sau khi tạo asset, kèm field phụ `status: "processing"` — client cũ chỉ đọc `src` nên không vỡ).
- **AP-03:** `scopes String[]` với giá trị V1: `assets:read`, `assets:write`, `shares:read`; endpoint kiểm scope trước khi vào service; key thiếu scope trả 403.
- **AP-04:** Mặc định 60 request/phút/key (upload: 20/phút/key); vượt trả 429 + headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; mọi request API ghi `UsageEvent` metric `API_REQUEST` (nền cho billing SaaS).

### 4i. Auth & Workspace

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| AU-01 | Là người dùng, tôi muốn đăng ký bằng email/password và đăng nhập bằng Google OAuth để vào app nhanh. | P0 | 0 |
| AU-02 | Là người dùng mới, tôi muốn được tạo sẵn workspace cá nhân khi đăng ký để dùng ngay không phải cấu hình. | P0 | 0 |
| AU-03 | Là owner, tôi muốn mọi dữ liệu (asset, album, share...) scope chặt theo workspace để sẵn sàng multi-tenant. | P0 | 0 |
| AU-04 | Là owner, tôi muốn mời thành viên vào workspace qua email với role MEMBER. | P2 | 6 |
| AU-05 | Là owner, tôi muốn phân biệt quyền OWNER và MEMBER (member không xóa vĩnh viễn asset người khác, không vào Admin/Settings workspace). | P1 | 6 |

**Acceptance criteria:**

- **AU-01:** Better Auth (email/password + Google), session cookie httpOnly + secure; sign-up có verify email (P1); đổi/quên mật khẩu hoạt động; route group `(app)` có auth guard ở layout — chưa đăng nhập redirect `/sign-in`.
- **AU-02:** Hook sau sign-up tạo `Workspace` (slug từ tên user) + `WorkspaceMember` role `OWNER` trong cùng transaction; UI V1 không lộ khái niệm workspace (ẩn switcher) — nhưng mọi query đã đi qua `workspaceId`.
- **AU-03:** Mọi service nhận `workspaceId` từ session context; test integration xác nhận user A không đọc/sửa/xóa được asset của workspace B (kể cả qua API key); dùng Better Auth **organization plugin** làm nền Workspace/Member/Invitation.
- **AU-04:** Invite qua email (token link, hết hạn 7 ngày), người nhận đăng ký/đăng nhập rồi join; role mặc định `MEMBER`.
- **AU-05:** Enum role V1 chỉ dùng `OWNER` / `MEMBER` (schema để mở cho giá trị mới); ma trận quyền tối thiểu: MEMBER được upload/album/share/trash asset của mình; chỉ OWNER được purge Trash toàn workspace, quản lý member, API key workspace, và vào `/admin`.

### 4j. Admin & Analytics

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| AD-01 | Là owner, tôi muốn xem analytics: dung lượng, số asset, upload theo ngày, top share được xem/tải. | P1 | 6 |
| AD-02 | Là owner, tôi muốn audit log viewer: ai làm gì, lúc nào, với đối tượng nào — filter theo action/user/thời gian. | P0 | 4 (ghi log) + 6 (viewer UI) |
| AD-03 | Là owner, tôi muốn quản lý user/member: danh sách, vô hiệu hóa, đổi role. | P1 | 6 |
| AD-04 | Là owner, tôi muốn thấy sức khỏe hệ thống: asset FAILED, job lỗi, trạng thái StorageChannel, và reprocess/retry từ UI. | P1 | 6 |
| AD-05 | Là owner, tôi muốn block một asset khỏi mọi hình thức serve công khai (moderation) khi phát hiện nội dung không phù hợp. | P2 | 6 |

**Acceptance criteria:**

- **AD-01:** Số liệu tổng hợp từ `Activity` + `UsageEvent` (metric `UPLOAD_BYTES`, `BANDWIDTH_BYTES`, `API_REQUEST`); biểu đồ 30 ngày; số liệu dung lượng khớp tổng `Asset.size` (sai số 0).
- **AD-02:** Mọi mutation (upload, delete, restore, rename, share create/revoke, member change, API key create/revoke, đăng nhập thất bại) ghi `Activity {action, targetType, targetId, userId, ip, meta}` ngay từ Phase tương ứng của tính năng; viewer phân trang server-side, filter theo `action`, `userId`, khoảng thời gian; log là append-only (không API sửa/xóa).
- **AD-04:** Bảng asset `status = FAILED` kèm lý do (từ `Activity`/meta) + nút retry; link sang Inngest dashboard cho job-level debug; `StorageChannel` list hiển thị trạng thái kênh Telegram (sẵn cho multi-channel).
- **AD-05:** Asset bị block → `/f/[assetId]` và `/s/[token]` chứa nó trả HTTP 451 + placeholder JSON/trang thông báo; kiểm tra bằng cột trạng thái moderation trên `Asset`; KHÔNG dùng cơ chế Referer-bypass như repo cũ (lỗ hổng: client tự set Referer chứa `/admin` là xem được ảnh chặn).

### 4k. Settings

| ID | User story | Priority | Phase |
|----|-----------|----------|-------|
| ST-01 | Là người dùng, tôi muốn quản lý hồ sơ (tên, avatar), đổi mật khẩu, và cài theme (dark mặc định / light / system). | P0 | 6 (profile tối thiểu từ Phase 0) |
| ST-02 | Là người dùng, tôi muốn chọn ngôn ngữ giao diện vi/en. | P1 | 6 |
| ST-03 | Là owner, tôi muốn Export/Backup: tải zip toàn bộ (hoặc theo album) về máy, hoặc đẩy bản backup sang R2. | P0 | 3 |
| ST-04 | Là owner, tôi muốn cấu hình mặc định cho share link (expiry mặc định, cho phép download). | P2 | 6 |

**Acceptance criteria:**

- **ST-03 (quan trọng — an toàn dữ liệu):** Export chạy như Inngest job: stream original từ Telegram → đóng gói zip theo lô kèm file `manifest.json` (metadata + checksum) → cung cấp link tải (hoặc ghi vào R2 bucket backup); verify `checksumSha256` từng file trong lúc export, file lệch checksum bị đánh dấu trong manifest; backup metadata DB (mapping `tgFileId`/`tgMessageId`) nằm trong cơ chế backup tự động mô tả ở [03 System Architecture](03_SYSTEM_ARCHITECTURE.md). *(Lý do P0 ở Phase 3: mất Postgres = mất mapping → file trên Telegram thành rác vĩnh viễn; Telegram không có SLA — đường lui dữ liệu phải có trước khi mời người khác dùng.)*
- **ST-01:** Theme lưu per-user, áp dụng không FOUC (script inline trước hydration, `next-themes`).
- **ST-02:** i18n vi/en với vi là mặc định; chuỗi UI tách file messages, không hardcode.

---

## 5. Non-functional requirements

### 5.1 Performance targets (đo được, kiểm ở Phase 6)

| Chỉ số | Mục tiêu | Điều kiện đo |
|---|---|---|
| LCP trang Gallery | < 2.5s | 4G throttle, cache lạnh, 1.000 asset |
| TTFB trang Gallery (RSC) | < 800ms | Vercel region gần nhất, Neon warm |
| Thumbnail size | ≤ 30KB trung bình | 320px WebP q72, đo trên ≥ 100 ảnh thật |
| Blur placeholder | Hiển thị cùng frame render đầu | thumbhash decode client, không request mạng |
| Scroll gallery 10.000 ảnh | Không jank nhìn thấy (~60fps) | virtualized, DevTools performance |
| Thumb/preview qua CDN (cache hit) | TTFB < 100ms | Cloudflare CDN, region VN |
| `/f/[assetId]` original (cache miss) | TTFB < 1.2s | tgFilePath đã cache; miss getFile +1 round-trip |
| Search hybrid (FTS + vector + RRF) | P95 < 1.5s | 50.000 asset, HNSW index |
| Upload feedback đầu tiên | < 200ms sau khi thả file | progress bar xuất hiện |
| Thời gian asset READY (ảnh ≤ 5MB) | P50 < 30s, P95 < 2 phút | gồm hàng đợi throttle Telegram ~18 msg/phút/kênh |

### 5.2 Bảo mật

- Better Auth session (httpOnly, secure, SameSite); RBAC scope theo workspace ở **service layer** — không tin client.
- Zod validate **mọi** input (server action, route handler, job payload); upload validate **magic bytes** để xác định loại file thật — không tin MIME của browser (repo cũ tin `file.type` hoàn toàn).
- Mọi mutation qua POST/Server Action có CSRF protection chuẩn Next.js — **không có endpoint mutation nào nhận GET** (repo cũ: delete/block qua GET, dính CSRF bằng 1 thẻ `<img>`).
- Signed URL HMAC-SHA256 (`?sig=&exp=`) cho file công khai; secret riêng (`SHARE_SIGNING_SECRET`), TTL ngắn; bot token/API key không bao giờ ra client hoặc log.
- Rate limit: auth endpoints (chống brute-force, thay cho Basic Auth so sánh non-constant-time của repo cũ), share password attempts, API key theo mục 4h.
- Security headers: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`; response file có `Content-Disposition` đúng để chống XSS qua SVG/HTML upload (serve `Content-Type` từ DB đã verify, SVG serve như attachment hoặc sanitize).
- Audit log (`Activity`) append-only cho mọi hành động nhạy cảm; không `console.log` env/secret (repo cũ `console.log(env)` in cả bot token ra log).
- Không có telemetry bên thứ ba gửi dữ liệu ra ngoài (repo cũ hardcode Sentry DSN + Hotjar + Clarity của tác giả gốc — loại bỏ toàn bộ; observability của HuaCloud dùng tài khoản riêng, opt-in).

### 5.3 Khả dụng & độ bền dữ liệu

- AI degrade gracefully (AI-05); Inngest gián đoạn → asset kẹt ở `PENDING`/`PROCESSING` nhưng file còn nguyên trên Blob staging (job `reconcile-assets` tự vớt), replay được, không mất dữ liệu.
- Backup tự động DB (Neon PITR + export định kỳ) là **bắt buộc từ sớm**; Export/Backup người dùng ở Phase 3 (ST-03).
- `StoragePart.backend` enum `TELEGRAM | R2` là đường swap original sang R2 khi SaaS có doanh thu — không phải viết lại schema.
- Mục tiêu uptime V1 (self-use → beta): 99.5%; trang lỗi có nội dung tử tế, không stack trace ra client (repo cũ trả `err.stack` về client).

### 5.4 i18n, A11y, SEO

- **i18n:** vi (mặc định) + en, Phase 6; không hardcode chuỗi trong component từ Phase 0 trở đi (dùng key ngay cả khi mới có 1 ngôn ngữ).
- **A11y:** điều hướng bàn phím đầy đủ (gallery, lightbox, dialog); focus ring rõ; contrast đạt WCAG AA trên dark theme; ảnh có alt (ưu tiên `aiCaption`, fallback `fileName`); dropzone và progress có aria-live.
- **SEO:** chỉ Landing và `/s/[token]` được index (metadata + OG image động); toàn bộ `(app)` gắn `noindex`; sitemap chỉ chứa trang marketing.

---

## 6. Feature parity với repo cũ (Telegraph-Image → HuaCloud)

| Tính năng repo cũ | Cơ chế cũ | HuaCloud | Ghi chú |
|---|---|---|---|
| Upload API `POST /upload`, response `[{src: "/file/{file_id}.{ext}"}]` | Public, không auth, multipart field `file` | `POST /api/v1/upload` + API key, response giữ shape `[{src: "/f/{assetId}"}]` | Tương thích tối thiểu để migrate script (AP-02); không còn endpoint upload public vô danh |
| Serve `GET /file/{id}` — gọi `getFile` mỗi request, không cache | 2 round-trip Telegram/lượt xem | `GET /f/[assetId]` + `tgFilePath` cache ~50 phút + retry 1 lần khi 404 + `Cache-Control` immutable; thumb/preview từ R2/CDN | Fix hot path lớn nhất |
| `ListType` Block/White (`/api/manage/block|white/[id]`) + `WhiteList_Mode` | Metadata KV, mutation bằng GET, bypass bằng Referer `/admin` | Trạng thái moderation trên `Asset` quản lý trong Admin (AD-05); app private-by-default nên không cần whitelist mode | Loại bỏ lỗ hổng Referer-bypass và CSRF-qua-GET |
| `liked` (`/api/manage/toggleLike/[id]`) | Boolean trong KV metadata | `Asset.isFavorite` + trang Favorites + phím tắt `F` (OR-03) | |
| `editName` (`/api/manage/editName/[id]`) | Bug: đọc `params.name` luôn `undefined` | Rename qua Server Action, Zod validate (OR-04) | Sửa bug gốc |
| `delete` (`/api/manage/delete/[id]`) | Chỉ xóa record KV; file Telegram sống vĩnh viễn, record tự tái tạo khi truy cập lại | Soft delete → Trash 30 ngày → purge thật bằng `deleteMessage` nhờ `tgMessageId` (OR-05/06) | Khắc phục "delete giả" |
| Admin list `GET /api/manage/list` (KV cursor) + 3 trang admin rời rạc (admin.html / admin-imgtc / admin-waterfall) | Vue 2 + Element UI + jQuery, 3 codebase trùng lặp | Gallery (user-facing, virtualized) + `/admin` (quản trị) trên 1 codebase Next.js; masonry view thay admin-waterfall | Feature checklist của admin-imgtc (batch ops, filter, sort, file-type tabs) được hấp thụ vào Gallery |
| Basic Auth `BASIC_USER`/`BASIC_PASS` (không set = admin mở công khai) | HTTP Basic, so sánh chuỗi thô | Better Auth session + RBAC workspace; deny-by-default | |
| KV metadata 6 field (`TimeStamp, ListType, Label, liked, fileName, fileSize`) | Cloudflare KV | Model `Asset` trên Postgres (đầy đủ hơn: checksum, EXIF, AI fields, embedding...) | Mapping dữ liệu khi cần migrate ảnh cũ: script đọc KV → tạo Asset |
| Content moderation qua moderatecontent.com | Hardcode domain telegra.ph — thực tế vô nghĩa với file Bot API; chạy lại mỗi lượt xem | **BỎ** dịch vụ ngoài; cột category/nsfw từ Gemini (aiMeta) + block tay trong Admin | moderatecontent.com cũng đã ngừng hoạt động ổn định |
| `block-img.html` / `whitelist-on.html` (trang tĩnh redirect 302) | Redirect khi bị chặn/chưa duyệt | HTTP 451 + trang thông báo trong app cho asset bị block; không còn whitelist flow | |
| Upload bằng `sendPhoto` cho ảnh (Telegram nén lại, mất EXIF/bytes gốc) | Phân loại theo MIME browser | **Luôn `sendDocument`** cho ORIGINAL — giữ nguyên 100% bytes | Quyết định kiến trúc đã chốt |
| Retry upload: fallback sendPhoto→sendDocument + backoff tay | Tự viết trong function | Inngest retries 4 + exponential backoff + throttle 18 msg/phút/kênh | |
| Kiểm tra file hỏng (检测失效文件, HEAD từng file) | Client-side tuần tự | Job `reconcile` verify checksum/getFile định kỳ (P2, Phase 6) | |
| Legacy proxy telegra.ph (path ≤ 39 ký tự) | Magic number phân nhánh | **BỎ** — HuaCloud không có dữ liệu legacy Telegraph | |
| Bing wallpaper API (`/api/bing/wallpaper`) + background slider trang chủ | Trang trí landing cũ | **BỎ hẳn** | |
| `index-md.html` (hack DOM setInterval tạo link Markdown) | Không có source Nuxt để sửa | **BỎ** — nút copy đa format (URL / Markdown / HTML / BBCode) tích hợp sẵn trong lightbox & sau upload (P1) | |
| Quick links lưu localStorage trong admin-imgtc | Tiện ích cá nhân tác giả cũ | **BỎ** | |
| Sentry DSN hardcode + Hotjar + MS Clarity của tác giả gốc | Telemetry leak về upstream | **BỎ toàn bộ**; observability riêng, opt-in | Bắt buộc theo yêu cầu branding |
| Nuxt 2 build không source (`_nuxt/`), Vue 2/Element UI/jQuery | Không maintain được | Viết mới 100% bằng Next.js 15 + shadcn/ui | Repo git **mới** (fresh history); repo cũ chỉ để tham khảo |

---

## 7. Out of scope V1 (backlog có chủ đích)

| Hạng mục | Lý do loại khỏi V1 | Điều kiện mở lại |
|---|---|---|
| File > 20MB (chunking hoặc local Bot API server) | `getFile` chỉ tải ≤ 20MB; chunking là code không nhỏ | Schema `StoragePart.partIndex` đã sẵn; làm khi có nhu cầu thật hoặc khi chuyển VPS (Phase 6 đường thoát) |
| Video transcode / poster frame / video AI | ffmpeg nặng, không cần cho use case ảnh | Worker riêng khi self-host |
| Resumable upload byte-level (tus) | Blob client upload không hỗ trợ; retry-per-file đủ cho ảnh ≤ 20MB | Khi hỗ trợ file lớn |
| Editor ảnh nâng cao (crop/rotate/watermark, filter) | IM-05 = P2; không nằm trên đường "dùng thật hằng ngày" | Sau V1, transform trên preview/original |
| AVIF output | Encode chậm 5-10x trên serverless; WebP đủ nhỏ | Khi có worker riêng |
| CLIP/SigLIP cross-modal embedding local | Không chạy trên Vercel serverless; text encoder tiếng Việt chưa kiểm chứng | Worker riêng; thay/bổ sung embedding hiện tại |
| Multi-language OCR chuyên sâu (handwriting, layout phân tích) | Gemini OCR mặc định đủ cho hóa đơn/screenshot | Nhu cầu thật từ người dùng |
| Mobile app (iOS/Android) | Web responsive + PWA-ready là đủ V1 | Sau khi SaaS có người dùng |
| Billing/Stripe, plan trả phí | Metering (`UsageEvent`) đã ghi từ V1, billing chưa cần | Khi mở SaaS công khai |
| Multi-workspace UI + workspace switcher | Schema multi-tenant sẵn, UI 1 workspace mặc định | Phase 6+ / SaaS |
| Real-time collaboration (websocket, presence) | Polling React Query đủ cho trạng thái processing | Khi có team dùng đồng thời nhiều |
| Public gallery / khám phá cộng đồng | HuaCloud là DAM riêng tư, không phải image board | Không có kế hoạch |
| Migrate tự động dữ liệu từ deployment Telegraph-Image cũ | Repo cũ là clone tham khảo, dữ liệu cá nhân migrate bằng script một lần (KV → Asset) nếu cần | Script ad-hoc, không phải tính năng sản phẩm |

---

## 8. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [00_CODEBASE_AUDIT.md](00_CODEBASE_AUDIT.md) | Khảo sát chi tiết repo gốc — cái gì tham khảo được, cái gì bỏ |
| [01_PROJECT_VISION.md](01_PROJECT_VISION.md) | Tầm nhìn, mục tiêu, nguyên tắc kiến trúc & làm việc |
| [03_SYSTEM_ARCHITECTURE.md](03_SYSTEM_ARCHITECTURE.md) | Kiến trúc hệ thống, luồng dữ liệu, database schema, quyết định kỹ thuật |
| [04_DEVELOPMENT_ROADMAP.md](04_DEVELOPMENT_ROADMAP.md) | Chia task theo 6+1 phase, thứ tự triển khai, definition of done |
