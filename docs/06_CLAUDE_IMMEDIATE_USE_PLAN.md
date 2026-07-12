# HuaCloud - Claude Code plan de dung duoc ngay

Ngay cap nhat: 2026-07-12

## Trang thai hien tai da xac minh

- App da la Next.js 15 + React 19 + Prisma + SQLite local, khong con la entrypoint Cloudflare/Telegraph cu.
- Upload UI da co: chon file, multi-file, keo-tha, paste Ctrl+V, panel tien trinh.
- Gallery da co: grid masonry, infinite scroll, lightbox, favorite, trash, retry, download original.
- Storage pipeline da co: staging local -> Sharp thumbnail/preview -> original LOCAL hoac TELEGRAM -> READY.
- Telegram driver da co: `sendDocument`, `getFile`, cache `tgFilePath`, `deleteMessage`.
- Local fallback da co: neu chua co Telegram chat id, app van upload va xem anh bang `.data/originals`.
- Diagnostics da co: `/settings` va `/api/health`.
- Kiem tra da pass sau ngay 2026-07-12:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npx prisma validate`

Tinh trang runtime tai may nay:

- Dev server dang phan hoi o `http://localhost:3000`.
- Database OK.
- Bot token co ve da doc duoc, nhung `TELEGRAM_CHAT_ID` chua cau hinh nen file moi se roi vao local fallback cho den khi chay `npm run telegram:setup`.
- AI chua cau hinh, khong anh huong MVP.

## Cach dung ngay cho owner

1. Tao private channel/group Telegram ten `HuaCloud Storage`.
2. Add bot HuaCloud lam admin trong channel/group do.
3. Gui 1 tin nhan bat ky vao channel/group.
4. Chay:

```bash
npm run telegram:setup
```

5. Restart dev server neu dang chay.
6. Mo `http://localhost:3000/gallery` va keo-tha anh vao de upload.
7. Vao `http://localhost:3000/settings`; Telegram Storage phai hien trang thai OK.

Neu da upload anh truoc khi cau hinh Telegram, anh do dang nam local. Sau khi Telegram OK, bam retry tren asset loi hoac can them script batch migrate local -> Telegram trong plan duoi.

## Prompt dan thang vao Claude Code

```text
Ban la Senior Full-stack Engineer tiep tuc du an HuaCloud cua Hua Hung.

Muc tieu cua phien nay: KHONG lam lai scaffold. Hay bien ban hien tai thanh personal image storage co the dung hang ngay voi Telegram lam kho original, local chi la fallback/dev.

Bat buoc doc truoc:
- docs/06_CLAUDE_IMMEDIATE_USE_PLAN.md
- src/server/jobs/process-asset.ts
- src/server/storage/telegram/driver.ts
- src/server/storage/telegram/client.ts
- src/server/services/asset.service.ts
- src/app/api/health/route.ts
- src/app/(app)/settings/settings-view.tsx
- README.md

Trang thai hien tai:
- Next.js app build da pass.
- Upload/gallery/lightbox/favorite/trash da co.
- Telegram driver da co.
- Van con single-user context, chua auth that.
- Neu chua co TELEGRAM_CHAT_ID, pipeline luu original vao LOCAL fallback.

Pham vi bat buoc:

1. Quickstart dung ngay
- Viet lai README theo dung project hien tai, khong giu README Telegraph cu.
- Them muc "5 phut chay local" gom:
  npm install
  npm run db:migrate hoac npm run db:push
  npm run db:seed
  npm run telegram:setup
  npm run dev
  mo /gallery
- Giai thich ro: token khong commit, .env.local bi gitignore, local fallback chi de dev.

2. Doctor command
- Tao `scripts/doctor.ts`.
- Them script `npm run doctor`.
- Doctor phai check:
  database connect
  default user/workspace exists
  TELEGRAM_BOT_TOKEN exists
  TELEGRAM_CHAT_ID exists
  bot getMe OK
  getChat OK
  StorageChannel active exists
  .data folders writable
- Khong in secret/token.
- Exit code 0 khi san sang upload Telegram, exit code khac khi thieu cau hinh.

3. Batch migrate local originals len Telegram
- Tao `scripts/migrate-local-to-telegram.ts`.
- Them script `npm run storage:migrate-telegram`.
- Tim cac `StoragePart` variant ORIGINAL backend LOCAL.
- Neu Telegram chua OK thi dung voi thong bao ro.
- Upload tung file local len Telegram bang `telegramDriver.put`.
- Update StoragePart sang TELEGRAM, luu `tgChatId`, `tgFileId`, `tgMessageId`.
- Sau khi upload thanh cong moi xoa local original.
- Co dry-run option `--dry-run`.
- Khong dung destructive command.

4. Settings UX
- Cap nhat Settings de hien ro 3 trang thai:
  Telegram ready
  Telegram missing chat id
  Local fallback active
- Neu missing chat id, hien checklist ngan gon:
  tao channel, add bot admin, gui tin nhan, chay `npm run telegram:setup`, restart dev server.
- Hien queue pending va so asset ORIGINAL dang LOCAL.

5. Upload safety
- Trong upload/gallery, neu Telegram chua san sang, hien warning nho: "Dang luu local fallback, hay cau hinh Telegram de giai phong dung luong may."
- Khong chan upload local, vi owner can dung ngay.

6. Verification
- Chay va sua den khi pass:
  npm run typecheck
  npm run lint
  npm run build
  npx prisma validate
- Neu co Telegram env that, chay them:
  npm run doctor
  npm run storage:migrate-telegram -- --dry-run
- Khong chay test upload len Telegram neu owner chua cho phep.

Ket qua cuoi phien:
- README dung voi code hien tai.
- `npm run doctor` noi chinh xac app da san sang chua.
- Owner co the upload anh, xem gallery, va biet ro file dang nam Telegram hay local.
- Co duong migrate cac file local len Telegram sau khi cau hinh xong.
```

## Viec khong lam trong phien nay

- Khong them AI.
- Khong them share public.
- Khong them multi-user/auth day du.
- Khong doi schema lon neu khong bat buoc.
- Khong refactor UI lon.

Uu tien hien tai la: dung duoc, biet file dang luu o dau, co cach day local sang Telegram, va build luon xanh.
