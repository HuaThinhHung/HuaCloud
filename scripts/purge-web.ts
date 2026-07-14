/* eslint-disable no-console */
// Xóa TOÀN BỘ dữ liệu ảnh phía WEB của HuaCloud:
//   - thumbnail/preview + staging trên Vercel Blob
//   - mọi bản ghi Asset trong Neon (kéo theo StoragePart / AlbumAsset / Share qua cascade)
// KHÔNG đụng tới Telegram (chủ ý bỏ — Hưng tự xóa file gốc trong chat Telegram).
// GIỮ lại vỏ album (chỉ trống ảnh) và tài khoản/workspace.
//
// Chạy thử (chỉ ĐẾM, không xóa):  npx tsx scripts/purge-web.ts
// Chạy THẬT (xóa vĩnh viễn):       npx tsx scripts/purge-web.ts --confirm
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { del } from "@vercel/blob";

// Nạp env như các script khác (DATABASE_URL trỏ Neon production, BLOB token...).
for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const CONFIRM = process.argv.includes("--confirm");
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const [assetCount, partCount, albumAssetCount, albumCount] = await Promise.all([
    prisma.asset.count(),
    prisma.storagePart.count(),
    prisma.albumAsset.count(),
    prisma.album.count(),
  ]);

  const [blobParts, stagingAssets] = await Promise.all([
    prisma.storagePart.findMany({ where: { blobUrl: { not: null } }, select: { blobUrl: true } }),
    prisma.asset.findMany({
      where: { stagingUrl: { startsWith: "http" } },
      select: { stagingUrl: true },
    }),
  ]);
  const blobUrls = [
    ...blobParts.map((p) => p.blobUrl as string),
    ...stagingAssets.map((a) => a.stagingUrl as string),
  ];

  console.log("── HuaCloud · xóa dữ liệu ảnh phía web ──");
  console.log(`Ảnh (Asset):        ${assetCount}`);
  console.log(`StoragePart:        ${partCount}`);
  console.log(`Liên kết album:     ${albumAssetCount}  (album giữ lại: ${albumCount})`);
  console.log(`Blob cần xóa:       ${blobUrls.length}`);

  if (!CONFIRM) {
    console.log("\n[CHẠY THỬ] Chưa xóa gì. Thêm cờ --confirm để xóa thật.");
    return;
  }

  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobUrls.length && hasBlobToken) {
    console.log(`\nĐang xóa ${blobUrls.length} blob (theo lô 100)...`);
    let ok = 0;
    for (let i = 0; i < blobUrls.length; i += 100) {
      const chunk = blobUrls.slice(i, i + 100);
      try {
        await del(chunk);
        ok += chunk.length;
      } catch (e) {
        console.warn(`  lô blob lỗi (bỏ qua): ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`  đã xóa ~${ok}/${blobUrls.length} blob.`);
  } else if (blobUrls.length) {
    console.log("\nBỏ qua Blob (không có BLOB_READ_WRITE_TOKEN trong env).");
  }

  const removed = await prisma.asset.deleteMany({});
  console.log(`\nĐã xóa ${removed.count} bản ghi ảnh (StoragePart/AlbumAsset/Share theo cascade).`);

  const [remaining, albumsLeft] = await Promise.all([prisma.asset.count(), prisma.album.count()]);
  console.log(`Còn lại: ${remaining} ảnh · ${albumsLeft} album (giữ vỏ, đã trống).`);
  console.log("\n✓ Xong phía web. Bước còn lại: Hưng tự xóa file gốc trong chat Telegram.");
}

main()
  .catch((e) => {
    console.error("Lỗi:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
