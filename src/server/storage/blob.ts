import "server-only";
import { del, put } from "@vercel/blob";

/**
 * Helper Vercel Blob — dùng khi DEPLOY (có BLOB_READ_WRITE_TOKEN).
 * Local (chưa có token) KHÔNG gọi tới đây; vẫn ghi .data như thường.
 * Vai trò: (1) staging ảnh upload từ client (né body-limit 4.5MB),
 * (2) lưu thumbnail/preview .webp để gallery phục vụ qua CDN.
 * Token đọc tự động từ env BLOB_READ_WRITE_TOKEN.
 */

/** Tải bytes của 1 blob (staging đã upload) về Buffer để xử lý. */
export async function fetchBlobBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được blob (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Ghi 1 derivative (thumb/preview) lên Blob public, trả URL CDN. */
export async function putDerivedBlob(
  pathname: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const res = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return res.url;
}

/** Xóa 1 blob (staging sau khi xử lý xong, hoặc derived khi hard-delete). */
export async function deleteBlob(url: string | null | undefined): Promise<void> {
  if (!url) return;
  await del(url).catch(() => {});
}
