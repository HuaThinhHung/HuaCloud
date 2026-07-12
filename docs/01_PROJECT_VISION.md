# 01 — PROJECT VISION

# HuaCloud — AI-Powered Digital Asset Management Platform

| | |
|---|---|
| **Sản phẩm** | HuaCloud |
| **Tác giả / Owner** | Hua Hưng |
| **Phiên bản tài liệu** | 1.0 |
| **Ngày cập nhật** | 2026-07-05 |
| **Bộ tài liệu** | [01 Vision](01_PROJECT_VISION.md) · [02 Product Requirements](02_PRODUCT_REQUIREMENTS.md) · [03 System Architecture](03_SYSTEM_ARCHITECTURE.md) · [04 Development Roadmap](04_DEVELOPMENT_ROADMAP.md) |

---

## 1. Tuyên bố mục tiêu

Biến repository hiện tại (fork của Telegraph-Image — một image host chạy trên Cloudflare Pages, license CC0) thành **một sản phẩm hoàn toàn mới mang thương hiệu HuaCloud**.

- Repository gốc chỉ đóng vai trò **tham khảo kỹ thuật** (đặc biệt là lớp tích hợp Telegram Bot API), không phải nền tảng để giữ nguyên giao diện, cấu trúc hay thương hiệu.
- Khi hoàn thành, người khác **không thể nhận ra** đây từng là repository gốc.
- Đây không phải "website upload ảnh bằng Telegram" — đây là **nền tảng quản lý hình ảnh và tài nguyên số (DAM) tích hợp AI**, trong đó Telegram chỉ là storage backend ẩn hoàn toàn khỏi người dùng.

## 2. Tầm nhìn sản phẩm

Trải nghiệm người dùng phải tương đương các sản phẩm hiện đại: **Google Photos, Cloudinary, Dropbox, Notion, Vercel Dashboard**.

Tính cách sản phẩm: hiện đại · tối giản · cao cấp · mượt mà · nhanh · dễ sử dụng · sẵn sàng mở rộng thành SaaS.

### Người dùng có thể

- Upload ảnh (kéo thả, nhiều file, cả thư mục, dán từ clipboard)
- Quản lý ảnh theo album / thư mục / smart album / favorites
- Tìm kiếm bằng AI với ngôn ngữ tự nhiên ("tìm ảnh áo xanh", "tìm hóa đơn tháng 6")
- Chia sẻ có kiểm soát (public/private link, mật khẩu, hết hạn, giới hạn lượt tải, QR code)
- Tối ưu ảnh tự động (thumbnail, WebP/AVIF, compress, watermark)
- Tích hợp hệ thống khác qua **REST API + API Key**

## 3. Yêu cầu thương hiệu (bắt buộc)

Loại bỏ **toàn bộ** dấu vết repository gốc, thay bằng thương hiệu HuaCloud tại: tên dự án, logo, icon, favicon, README, metadata, package name, repository name, SEO, Open Graph, footer, header, navbar, landing page, dashboard, loading screen, manifest, documentation.

> **Ghi chú pháp lý:** repo gốc dùng license **CC0 1.0 Universal** (public domain dedication) — không có nghĩa vụ attribution, việc rebrand và thương mại hóa là hợp lệ. HuaCloud sẽ chọn license riêng cho mã nguồn mới (xem [03 System Architecture](03_SYSTEM_ARCHITECTURE.md)).

## 4. Định hướng thiết kế

Cảm hứng: **Apple · Linear · Raycast · Vercel · Notion · Google Photos**

Tiêu chí: tối giản, khoảng trắng lớn, màu sắc hiện đại, typography đẹp, animation mượt, responsive, **dark mode mặc định**, trải nghiệm chuyên nghiệp như sản phẩm thương mại. Không giữ lại giao diện cũ nếu có thể cải thiện.

## 5. Công nghệ ưu tiên

Next.js 15 · TypeScript · TailwindCSS · shadcn/ui · Framer Motion · React Query · Prisma · PostgreSQL · Better Auth · Zod · React Hook Form · Sharp

Mọi phần đều hướng tới **Production Ready**. Chi tiết lựa chọn và lý do: [03 System Architecture](03_SYSTEM_ARCHITECTURE.md).

## 6. Phạm vi chức năng (tóm tắt)

Chi tiết đầy đủ từng tính năng: [02 Product Requirements](02_PRODUCT_REQUIREMENTS.md).

| Nhóm | Nội dung |
|---|---|
| **Upload** | Drag-drop, multi-file, upload thư mục, paste Ctrl+V, preview, progress bar, resume khi gián đoạn |
| **Gallery** | Grid / Masonry / List / Timeline, infinite scroll, lazy loading |
| **Tổ chức** | Album, thư mục, smart album, favorites |
| **Chia sẻ** | Link public/private, mật khẩu, thời hạn, giới hạn lượt tải, QR code |
| **AI** | Caption, tags, OCR, nhận diện vật thể, phân tích màu, phân loại, tìm ảnh tương tự, natural language search |
| **Xử lý ảnh** | Thumbnail, blur placeholder, WebP, AVIF, resize, compress, crop, rotate, watermark |
| **Trang** | Landing, Dashboard, Upload, Gallery, Albums, Search, Favorites, Shared, Trash, Analytics, Settings, Admin |
| **Nền tảng** | Auth, RBAC, workspace, API key, audit log, rate limit, background jobs |

## 7. Nguyên tắc kiến trúc & làm việc

1. **Feature-based Architecture + Clean Architecture + SOLID.** Tách rõ `components / features / hooks / services / lib / utils / types / database / ai / telegram / workers`. Không để logic lẫn trong component, không viết mã trùng lặp.
2. **Telegram là một module đóng gói riêng** (Telegram Service, Upload Queue, Retry, Rate Limit, Error Recovery). UI không được phụ thuộc trực tiếp vào Telegram.
3. Không giữ mã cũ chỉ vì "đang chạy được". Có giải pháp/kiến trúc/UI tốt hơn → refactor / thay đổi / thiết kế lại.
4. Luôn ưu tiên khả năng mở rộng và bảo trì lâu dài. Mã sạch, dễ đọc, có tài liệu, dễ kiểm thử.
5. Bảo mật là mặc định: authn/authz, input validation (Zod), rate limit, XSS/CSRF protection, upload validation, audit log.
6. Hiệu năng là mặc định: caching, streaming, Server Components, background jobs, virtualization, code splitting.

## 8. Mục tiêu cuối cùng

Khi hoàn thành, HuaCloud là **sản phẩm độc lập mang thương hiệu Hua Hưng**:

- Chất lượng đủ để đưa vào **portfolio**
- Dùng được trong **thực tế** (production)
- Sẵn sàng phát triển thành **SaaS** (multi-workspace, API public, usage metering)

## 9. Tài liệu liên quan

| File | Nội dung |
|---|---|
| [00_CODEBASE_AUDIT.md](00_CODEBASE_AUDIT.md) | Khảo sát chi tiết repo gốc — cái gì tham khảo được, cái gì bỏ |
| [02_PRODUCT_REQUIREMENTS.md](02_PRODUCT_REQUIREMENTS.md) | Chi tiết từng tính năng, user story, acceptance criteria |
| [03_SYSTEM_ARCHITECTURE.md](03_SYSTEM_ARCHITECTURE.md) | Kiến trúc hệ thống, luồng dữ liệu, database schema, quyết định kỹ thuật |
| [04_DEVELOPMENT_ROADMAP.md](04_DEVELOPMENT_ROADMAP.md) | Chia task theo giai đoạn, thứ tự triển khai, definition of done |
| [05_CLAUDE_NEXT_PLANS.md](05_CLAUDE_NEXT_PLANS.md) | 3 prompt thực thi cho các phiên Claude Code tiếp theo |
