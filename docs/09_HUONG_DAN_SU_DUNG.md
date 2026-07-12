# 09 — Hướng dẫn dùng HuaCloud hằng ngày

> Bản dùng **cá nhân trên máy** (Hưng đã chốt không deploy). Ảnh gốc lưu trên
> Telegram, ổ cứng chỉ giữ thumbnail nhẹ.

## 1. Mở HuaCloud

**Cách dễ nhất:** double-click file **`start-huacloud.bat`** ở thư mục gốc dự án.
Cửa sổ đen hiện ra, trình duyệt tự mở `http://localhost:3000`. Lần đầu hơi lâu (~10s),
nếu thấy trang lỗi thì đợi vài giây rồi bấm F5.

> Giữ cửa sổ đen đó MỞ trong lúc dùng. Đóng nó = tắt HuaCloud.

**Cách thủ công:** mở Terminal tại thư mục dự án → gõ `npm run dev` → mở trình duyệt `http://localhost:3000`.

## 2. Đưa ảnh vào kho

- **Kéo-thả** ảnh vào cửa sổ, hoặc **Ctrl+V** dán ảnh từ clipboard, hoặc bấm nút upload.
- Ảnh vào gallery ngay; ảnh **gốc tự động đẩy lên Telegram**, bản tạm trên ổ cứng tự xoá.
- Giới hạn hiện tại: **20MB/ảnh**.
- Ảnh trùng (đã có trong kho) sẽ tự bỏ qua, không lưu 2 lần.

## 3. Quản lý ảnh

- **Yêu thích**, **đổi tên**, **xoá** (vào Thùng rác), **khôi phục** từ Thùng rác.
- **Xoá hẳn** trong Thùng rác → xoá luôn file trên Telegram, giải phóng thật.
- Bấm ảnh để xem lớn (lightbox), tải bản gốc về.

## 4. ⚠️ Sao lưu — QUAN TRỌNG

File **`.data/huacloud.db`** là "bộ não" biết ảnh nào nằm ở đâu trên Telegram.
**Mất file này = ảnh vẫn trên Telegram nhưng app không tìm lại được** (thành mồ côi).

- Thỉnh thoảng chạy **`npm run backup`** → tạo bản sao trong `backups/<ngày-giờ>/`.
- Nên copy thư mục `backups/` lên **Google Drive / USB** định kỳ (vd mỗi tuần).
- Ảnh gốc thì luôn an toàn trên Telegram, không lo mất.

## 5. Khóa bằng mật khẩu (tùy chọn)

Nếu dùng máy chung và muốn khóa kho ảnh: mở `.env.local`, đặt
`APP_PASSWORD="mật-khẩu-của-bạn"`, khởi động lại. Từ đó vào app phải nhập mật khẩu.
Để trống thì vào thẳng như hiện tại.

## 6. Lưu ý

- **Đừng xoá** đoạn chat với **@HuaCloud_bot** trên Telegram — đó là nơi chứa ảnh gốc.
- Bot token nằm trong `.env.local` — giữ bí mật, đừng chia sẻ file này.
- Muốn xem kho ảnh từ điện thoại/xa sau này? Nhắn tôi — sẽ làm Chặng B (Neon + Vercel).

## 7. Kiểm tra sức khỏe hệ thống

- Trang **Cài đặt** trong app hiện trạng thái Database / Telegram.
- Hoặc chạy `npm run telegram:health` để kiểm tra bot còn hoạt động.
