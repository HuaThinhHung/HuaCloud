import "server-only";
import { readFile } from "node:fs/promises";
import { env, isBlobConfigured } from "@/lib/env";
import { memUsage } from "@/server/diagnostics/memory";
import { prisma } from "@/server/db/client";
import { processImage } from "@/server/media/process";
import { deleteBlob, fetchBlobBuffer, putDerivedBlob } from "@/server/storage/blob";
import { removeLocal, saveDerived, saveLocalOriginal } from "@/server/storage/local";
import { telegramDriver } from "@/server/storage/telegram/driver";

/**
 * Pipeline sau upload — chạy INLINE (await trong request) để hợp serverless
 * (Vercel không giữ process nền sau khi trả response):
 * PENDING → PROCESSING → [derivatives: Vercel Blob khi deploy / .data khi local]
 * → [original lên Telegram] → dọn staging → READY.
 *
 * providedBuffer: bytes có sẵn từ request (happy-path) — khỏi đọc lại staging.
 * Khi retry (không có buffer) → đọc lại từ stagingUrl (URL Blob http… hoặc path đĩa).
 */
export async function processAssetNow(assetId: string, providedBuffer?: Buffer): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return;
  if (asset.status === "READY") return; // idempotent

  // Atomic claim: chỉ MỘT worker được xử lý asset này. Chống race khi Vercel Blob
  // gọi onUploadCompleted 2 lần (retry vì xử lý ảnh lớn lâu) → tránh đẩy Telegram TRÙNG
  // và tránh badge FAILED chớp nháy. updateMany atomic ở tầng DB: worker thứ 2 khớp 0 dòng.
  const claim = await prisma.asset.updateMany({
    where: { id: assetId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", errorMessage: null },
  });
  if (claim.count === 0) {
    console.log(`[process-asset] ${assetId} bỏ qua — worker khác đang xử lý (hoặc đã xong)`);
    return;
  }
  console.log(`[process-asset] ${assetId} bắt đầu (${asset.size}B, ${asset.kind}) ${memUsage()}`);

  try {
    const buffer = providedBuffer ?? (await loadBuffer(asset.stagingUrl));

    let width: number | null = null;
    let height: number | null = null;
    let mimeType = asset.mimeType;
    let kind = asset.kind;

    // 1) Derivatives (chỉ ảnh) — verify bằng Sharp thay vì tin MIME browser
    if (asset.kind === "IMAGE") {
      try {
        const d = await processImage(buffer);
        width = d.width;
        height = d.height;
        mimeType = d.verifiedMime;

        // Blob khi deploy (gallery phục vụ qua CDN) / .data khi local
        const useBlob = isBlobConfigured();
        let thumbPath: string | null = null;
        let previewPath: string | null = null;
        let thumbBlobUrl: string | null = null;
        let previewBlobUrl: string | null = null;

        if (useBlob) {
          thumbBlobUrl = await putDerivedBlob(`derived/${assetId}/thumb.webp`, d.thumb, "image/webp");
          previewBlobUrl = await putDerivedBlob(`derived/${assetId}/preview.webp`, d.preview, "image/webp");
        } else {
          [thumbPath, previewPath] = await Promise.all([
            saveDerived(assetId, "thumb.webp", d.thumb),
            saveDerived(assetId, "preview.webp", d.preview),
          ]);
        }
        const backend = useBlob ? "BLOB" : "LOCAL";

        await prisma.$transaction([
          prisma.storagePart.upsert({
            where: { assetId_variant_partIndex: { assetId, variant: "THUMB", partIndex: 0 } },
            update: { backend, size: d.thumb.length, localPath: thumbPath, blobUrl: thumbBlobUrl },
            create: { assetId, variant: "THUMB", backend, size: d.thumb.length, localPath: thumbPath, blobUrl: thumbBlobUrl },
          }),
          prisma.storagePart.upsert({
            where: { assetId_variant_partIndex: { assetId, variant: "PREVIEW", partIndex: 0 } },
            update: { backend, size: d.preview.length, localPath: previewPath, blobUrl: previewBlobUrl },
            create: { assetId, variant: "PREVIEW", backend, size: d.preview.length, localPath: previewPath, blobUrl: previewBlobUrl },
          }),
          prisma.asset.update({
            where: { id: assetId },
            data: {
              width,
              height,
              mimeType,
              takenAt: d.takenAt,
              blurDataUrl: d.blurDataUrl,
              dominantColor: d.dominantColor,
            },
          }),
        ]);
      } catch {
        // File đuôi ảnh nhưng không decode được → xử lý như DOCUMENT
        kind = "DOCUMENT";
        await prisma.asset.update({ where: { id: assetId }, data: { kind } });
      }
    }

    // 2) Original — Telegram nếu đã cấu hình; LOCAL chỉ là fallback dev
    const existing = await prisma.storagePart.findUnique({
      where: { assetId_variant_partIndex: { assetId, variant: "ORIGINAL", partIndex: 0 } },
    });

    if (!existing || existing.backend === "LOCAL") {
      const hasChannel =
        env.TELEGRAM_BOT_TOKEN &&
        (env.TELEGRAM_CHAT_ID ||
          (await prisma.storageChannel.count({ where: { status: "ACTIVE" } })) > 0);

      if (hasChannel) {
        const put = await telegramDriver.put({ buffer, fileName: asset.fileName, mimeType });
        await prisma.storagePart.upsert({
          where: { assetId_variant_partIndex: { assetId, variant: "ORIGINAL", partIndex: 0 } },
          update: {
            backend: "TELEGRAM",
            size: put.size,
            tgChatId: put.tgChatId,
            tgFileId: put.tgFileId,
            tgMessageId: put.tgMessageId,
            localPath: null,
            blobUrl: null,
          },
          create: {
            assetId,
            variant: "ORIGINAL",
            backend: "TELEGRAM",
            size: put.size,
            tgChatId: put.tgChatId,
            tgFileId: put.tgFileId,
            tgMessageId: put.tgMessageId,
          },
        });
        if (existing?.localPath) await removeLocal(existing.localPath);
      } else if (isBlobConfigured()) {
        // Trên cloud không có đĩa ghi + chưa có Telegram → không thể giữ ảnh gốc
        throw new Error("Chưa cấu hình Telegram — không thể lưu ảnh gốc (chạy npm run telegram:setup)");
      } else if (!existing) {
        const localPath = await saveLocalOriginal(assetId, asset.fileName, buffer);
        await prisma.storagePart.create({
          data: { assetId, variant: "ORIGINAL", backend: "LOCAL", size: buffer.length, localPath },
        });
      }
    }

    // 3) Finalize — dọn staging SAU KHI original đã an toàn trên Telegram
    const originalNow = await prisma.storagePart.findUnique({
      where: { assetId_variant_partIndex: { assetId, variant: "ORIGINAL", partIndex: 0 } },
    });
    if (originalNow?.backend === "TELEGRAM" && asset.stagingUrl) {
      await cleanupStaging(asset.stagingUrl);
    }
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        status: "READY",
        errorMessage: null,
        stagingUrl: originalNow?.backend === "TELEGRAM" ? null : asset.stagingUrl,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    console.error(`[process-asset] ${assetId} FAILED: ${msg} ${memUsage()}`);
    // GIỮ staging khi FAILED để "Thử lại" đọc lại được bytes
    await prisma.asset.update({
      where: { id: assetId },
      data: { status: "FAILED", errorMessage: msg.slice(0, 500) },
    });
    throw e;
  }
}

/** Đọc bytes để xử lý: URL Blob (http…) tải qua fetch; path đĩa đọc trực tiếp. */
async function loadBuffer(stagingUrl: string | null): Promise<Buffer> {
  if (!stagingUrl) throw new Error("Thiếu dữ liệu để xử lý — hãy upload lại");
  return stagingUrl.startsWith("http")
    ? await fetchBlobBuffer(stagingUrl)
    : await readFile(stagingUrl);
}

async function cleanupStaging(stagingUrl: string): Promise<void> {
  if (stagingUrl.startsWith("http")) await deleteBlob(stagingUrl);
  else await removeLocal(stagingUrl);
}
