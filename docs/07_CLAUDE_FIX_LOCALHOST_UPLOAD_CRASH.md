# HuaCloud - Plan sua loi upload anh tren localhost lam sap website

Ngay tao: 2026-07-12

## Van de

Khi upload anh len localhost, website/dev server co the sap hoac treo. Can uu tien sua loi nay truoc moi tinh nang AI/share/auth vi upload la luong song con cua HuaCloud.

## Gia thuyet nguyen nhan chinh

1. `src/app/api/upload/route.ts` goi `req.formData()` truoc khi reject request lon. Neu file/request qua lon, Next dev server da phai doc body vao RAM.
2. Sau `formData()`, code goi `Buffer.from(await file.arrayBuffer())`, tao them mot ban copy trong RAM.
3. `src/server/media/process.ts` dung Sharp tao thumb, preview, blur va stats song song bang `Promise.all`; anh do phan giai lon co the lam RAM tang dot bien.
4. Queue xu ly anh la in-process (`src/server/jobs/queue.ts`), nen neu Sharp/libvips bi OOM/native crash thi keo sap ca Next dev server.
5. Client chi chan theo byte size 20MB, chua chan theo pixel dimensions/decompression bomb.
6. Server dang quyet dinh `kind` dua tren MIME browser truoc khi Sharp verify; neu MIME sai, pipeline co the di vao nhanh xu ly khong mong muon.

## Muc tieu sua

- Upload loi phai tra JSON error, khong lam sap web.
- Anh qua lon theo byte hoac pixel phai bi tu choi som voi thong bao ro.
- Sharp xu ly tiet kiem RAM hon, co gioi han input pixel.
- Co script test/repro de Claude Code va owner biet da sua that hay chua.
- Sau khi sua, cac lenh nay phai pass:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npx prisma validate`

## Prompt dan vao Claude Code

```text
Ban la Senior Full-stack Engineer dang sua loi nghiem trong cua HuaCloud.

Van de cua owner: "toi dua anh len localhost la sap luon website".

Khong lam AI/share/auth trong phien nay. Chi tap trung lam upload localhost khong con lam sap dev server.

Truoc khi code, doc cac file:
- docs/07_CLAUDE_FIX_LOCALHOST_UPLOAD_CRASH.md
- src/app/api/upload/route.ts
- src/server/services/asset.service.ts
- src/server/jobs/process-asset.ts
- src/server/jobs/queue.ts
- src/server/media/process.ts
- src/features/upload/upload-provider.tsx
- scripts/test-upload.ts

Pham vi bat buoc:

1. Tao reproduction va logging an toan
- Them logging ngan gon quanh upload/pipeline: assetId, fileName, size, mime, stage, memory RSS/heap.
- Khong log secret, khong log raw file content.
- Neu co the, them helper `src/server/diagnostics/memory.ts` de format memory usage.
- Cap nhat `scripts/test-upload.ts` de co option:
  - `--size small|large`
  - `--width <n>`
  - `--height <n>`
  - `--no-verify` neu chi muon test server nhan upload.

2. Reject request qua lon truoc khi doc formData
- Trong `src/app/api/upload/route.ts`, doc header `content-length`.
- Neu content-length lon hon gioi han hop ly, tra 413 ngay lap tuc truoc `req.formData()`.
- Dat hang so ro rang:
  - `MAX_FILE_BYTES = 20 * 1024 * 1024`
  - `MAX_UPLOAD_REQUEST_BYTES = MAX_FILE_BYTES + overhead multipart hop ly`
- Loi tra ve phai la JSON, khong throw ra ngoai.

3. Giam RAM khi upload
- Kiem tra lai `Buffer.from(await file.arrayBuffer())`.
- Chap nhan MVP van can Buffer, nhung phai dam bao chi sau khi da reject theo size.
- Neu file.size lon hon limit, reject truoc khi tao Buffer.
- Neu `file.arrayBuffer()` loi, tra 400/500 JSON than thien.

4. Lam Sharp pipeline chong sap
- Trong `src/server/media/process.ts`, cau hinh Sharp voi `limitInputPixels`.
- Dat gioi han pixel ro rang, vi du `MAX_IMAGE_PIXELS = 50_000_000` hoac gia tri hop ly.
- Sau khi doc metadata, reject anh co `width * height` vuot limit.
- Khong tao thumb/preview/blur/stats song song neu co nguy co RAM cao. Chuyen sang xu ly tuan tu hoac toi da 2 viec cung luc.
- Neu Sharp fail, asset phai thanh `FAILED` voi `errorMessage` ro, khong lam sap process.
- Can phan biet:
  - file khong phai anh hop le
  - anh qua lon theo pixel
  - Sharp/libvips decode fail

5. Bao ve queue in-process
- Kiem tra `src/server/jobs/queue.ts` de dam bao moi job catch error va khong tao unhandled rejection.
- Them handler local neu can:
  - `process.on("unhandledRejection")`
  - `process.on("uncaughtException")`
Chi them neu phu hop voi Next dev, khong che dau loi production. Muc tieu la log ro va giu server song neu loi JS-level.

6. UI upload phai noi ro loi
- Client da chan 20MB, giu lai.
- Neu API tra 413/400/500, hien dung message cho tung file, khong reload trang.
- Neu server dang xu ly local fallback/Telegram fail, asset hien `FAILED` va nut retry van dung duoc.

7. Them test/verification
- Chay:
  npm run typecheck
  npm run lint
  npm run build
  npx prisma validate
- Neu dev server dang chay, chay:
  npm run test:upload -- --size small
  npm run test:upload -- --width 9000 --height 9000 --no-verify
- Test anh qua gioi han phai fail mem bang JSON/asset FAILED, khong lam sap localhost.

Ket qua cuoi phien can bao cao:
- Nguyen nhan co kha nang cao nhat.
- File da sua.
- Gioi han upload/pixel moi.
- Lenh nao da pass.
- Cach owner tu test lai tren localhost.
```

## Definition of Done

- Upload anh binh thuong tren localhost khong sap web.
- Upload anh qua lon bi chan som, tra thong bao ro.
- Anh loi/khong decode duoc khong lam server chet; asset vao `FAILED`.
- Build/lint/typecheck pass.
- Co script test de lap lai loi va xac nhan da sua.

## Viec khong lam

- Khong them AI.
- Khong them public share.
- Khong them auth multi-user.
- Khong doi database schema lon neu khong bat buoc.
- Khong refactor UI lon.
