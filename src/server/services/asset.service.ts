import "server-only";
import { createHash } from "node:crypto";
import type { Asset, Prisma, StoragePart } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { Ctx } from "@/server/context";
import { processAssetNow } from "@/server/jobs/process-asset";
import { deleteBlob, fetchBlobBuffer } from "@/server/storage/blob";
import { removeAssetLocalData, saveStagingFile } from "@/server/storage/local";
import { telegramDriver } from "@/server/storage/telegram/driver";
import type { SmartQuery } from "@/types/album";
import type { AssetDTO, AssetKind, AssetListResponse, AssetStatus } from "@/types/asset";
import { logActivity } from "./activity.service";

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // chặn cứng 20MB (docs/03 ADR-06)

function kindFromMime(mime: string): AssetKind {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "DOCUMENT";
}

/**
 * DTO cho client. Nếu asset đã kèm `parts` và thumb/preview nằm trên Vercel Blob
 * (public CDN), trả THẲNG URL Blob → gallery tải trực tiếp từ CDN, KHÔNG qua
 * route `/f` (mỗi ảnh vốn tốn 1 lần chạy function + 1 query Neon → chậm/lag).
 * Ảnh GỐC vẫn đi qua `/f` để giữ auth + giấu token Telegram.
 */
export function toDTO(a: Asset & { parts?: StoragePart[] }): AssetDTO {
  const blobOf = (variant: string) =>
    a.parts?.find((p) => p.variant === variant && p.backend === "BLOB" && p.blobUrl)?.blobUrl ??
    null;
  return {
    id: a.id,
    fileName: a.fileName,
    kind: a.kind as AssetKind,
    status: a.status as AssetStatus,
    mimeType: a.mimeType,
    size: a.size,
    width: a.width,
    height: a.height,
    blurDataUrl: a.blurDataUrl,
    dominantColor: a.dominantColor,
    isFavorite: a.isFavorite,
    deletedAt: a.deletedAt?.toISOString() ?? null,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
    thumbUrl: blobOf("THUMB") ?? `/f/${a.id}?v=thumb`,
    previewUrl: blobOf("PREVIEW") ?? `/f/${a.id}?v=preview`,
    originalUrl: `/f/${a.id}?v=original`,
  };
}

export type SortKey = "new" | "old" | "name" | "size";

export type ListParams = {
  cursor?: string | null;
  take?: number;
  q?: string;
  view?: "all" | "favorites" | "trash";
  kind?: AssetKind;
  albumId?: string;
  sort?: SortKey;
  noAlbum?: boolean; // chỉ ảnh CHƯA nằm trong album nào (dọn thư viện chính)
  excludeAlbumId?: string; // ảnh CHƯA thuộc album này — dùng khi thêm ảnh từ trong album
};

/** Bộ lọc Prisma từ SmartQuery — dùng cho album thông minh (album.service import lại). */
export function smartWhere(q: SmartQuery | null): Prisma.AssetWhereInput {
  if (!q) return {};
  const w: Prisma.AssetWhereInput = {};
  if (q.kind) w.kind = q.kind;
  if (q.favorite) w.isFavorite = true;
  const gte = rangeStart(q.range) ?? (q.since ? new Date(q.since) : null);
  if (gte) w.createdAt = { gte };
  return w;
}

function rangeStart(range?: SmartQuery["range"]): Date | null {
  if (!range) return null;
  const d = new Date();
  switch (range) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d;
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "this-month":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "this-year":
      return new Date(d.getFullYear(), 0, 1);
    default:
      return null;
  }
}

function sortOrderBy(sort?: SortKey) {
  switch (sort) {
    case "old":
      return [{ createdAt: "asc" as const }, { id: "asc" as const }];
    case "name":
      return [{ fileName: "asc" as const }, { id: "asc" as const }];
    case "size":
      return [{ size: "desc" as const }, { id: "desc" as const }];
    default:
      return [{ createdAt: "desc" as const }, { id: "desc" as const }];
  }
}

export async function listAssets(ctx: Ctx, params: ListParams): Promise<AssetListResponse> {
  const take = Math.min(Math.max(params.take ?? 40, 1), 100);

  // Lọc theo album: album thường → membership; album thông minh → smartQuery.
  let albumWhere: Prisma.AssetWhereInput = {};
  if (params.albumId) {
    const album = await prisma.album.findFirst({
      where: { id: params.albumId, workspaceId: ctx.workspaceId },
    });
    if (!album) return { items: [], nextCursor: null, total: 0 };
    albumWhere = album.isSmart
      ? smartWhere(album.smartQuery ? (JSON.parse(album.smartQuery) as SmartQuery) : null)
      : { albums: { some: { albumId: params.albumId } } };
  }

  const where = {
    workspaceId: ctx.workspaceId,
    deletedAt: params.view === "trash" ? { not: null } : null,
    ...(params.view === "favorites" ? { isFavorite: true } : {}),
    ...(params.kind ? { kind: params.kind } : {}),
    ...(params.q ? { fileName: { contains: params.q, mode: "insensitive" as const } } : {}),
    ...(params.noAlbum && !params.albumId ? { albums: { none: {} } } : {}),
    ...(params.excludeAlbumId ? { albums: { none: { albumId: params.excludeAlbumId } } } : {}),
    ...albumWhere,
  };

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: sortOrderBy(params.sort),
      take: take + 1,
      // Kèm thumb/preview để toDTO trả URL Blob CDN trực tiếp (1 query cho cả trang,
      // thay vì mỗi ảnh 1 lần proxy /f). Chỉ 2 variant → nhẹ.
      include: { parts: { where: { variant: { in: ["THUMB", "PREVIEW"] } } } },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    }),
    prisma.asset.count({ where }),
  ]);

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return {
    items: page.map(toDTO),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
    total,
  };
}

export async function getAssetOwned(ctx: Ctx, id: string) {
  const asset = await prisma.asset.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { parts: true },
  });
  return asset;
}

export type CreateUploadResult =
  | { kind: "created"; asset: AssetDTO }
  | { kind: "duplicate"; asset: AssetDTO };

async function createAndProcess(
  ctx: Ctx,
  input: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    makeStaging: (assetId: string) => Promise<string>;
  },
): Promise<CreateUploadResult> {
  const { buffer } = input;
  if (buffer.length === 0) throw new Error("File rỗng");
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("Giới hạn hiện tại là 20MB/file");
  }

  const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

  // Dedupe theo workspace (docs/02 UP-08)
  const dup = await prisma.asset.findFirst({
    where: { workspaceId: ctx.workspaceId, checksumSha256, deletedAt: null, status: "READY" },
  });
  if (dup) return { kind: "duplicate", asset: toDTO(dup) };

  const fileName = sanitizeFileName(input.fileName);
  const mimeType = input.mimeType || "application/octet-stream";

  const asset = await prisma.asset.create({
    data: {
      workspaceId: ctx.workspaceId,
      uploaderId: ctx.userId,
      kind: kindFromMime(mimeType),
      status: "PENDING",
      fileName,
      mimeType,
      size: buffer.length,
      checksumSha256,
    },
  });

  const stagingUrl = await input.makeStaging(asset.id);
  await prisma.asset.update({ where: { id: asset.id }, data: { stagingUrl } });
  await logActivity(ctx, "asset.upload", "asset", asset.id, { fileName, size: buffer.length });

  // Xử lý INLINE — hợp serverless (function chắc chắn còn sống tới khi Telegram xong).
  await processAssetNow(asset.id, buffer);

  const final = (await prisma.asset.findUnique({ where: { id: asset.id } })) ?? asset;
  return { kind: "created", asset: toDTO(final) };
}

/** Local multipart: nhận buffer trực tiếp, lưu staging ra .data để retry được. */
export async function createFromUpload(
  ctx: Ctx,
  input: { fileName: string; mimeType: string; buffer: Buffer },
): Promise<CreateUploadResult> {
  return createAndProcess(ctx, {
    ...input,
    makeStaging: (assetId) => saveStagingFile(assetId, input.buffer),
  });
}

/** Vercel client-upload: file đã nằm trên Blob (staging), tải bytes về rồi xử lý. */
export async function createFromBlob(
  ctx: Ctx,
  input: { fileName: string; mimeType: string; blobUrl: string },
): Promise<CreateUploadResult> {
  const buffer = await fetchBlobBuffer(input.blobUrl);
  const result = await createAndProcess(ctx, {
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer,
    makeStaging: async () => input.blobUrl,
  });
  // Trùng → asset không được tạo; dọn blob staging vừa upload cho khỏi rác
  if (result.kind === "duplicate") await deleteBlob(input.blobUrl);
  return result;
}

export async function toggleFavorite(ctx: Ctx, id: string): Promise<AssetDTO> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  const updated = await prisma.asset.update({
    where: { id },
    data: { isFavorite: !asset.isFavorite },
  });
  return toDTO(updated);
}

export async function renameAsset(ctx: Ctx, id: string, newName: string): Promise<AssetDTO> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  const fileName = sanitizeFileName(newName);
  if (!fileName) throw new Error("Tên file không hợp lệ");
  const updated = await prisma.asset.update({ where: { id }, data: { fileName } });
  await logActivity(ctx, "asset.rename", "asset", id, { from: asset.fileName, to: fileName });
  return toDTO(updated);
}

/**
 * Đổi tên HÀNG LOẠT theo mẫu `{base}-{số}` — giữ nguyên đuôi file gốc của từng ảnh.
 * `ids` phải theo đúng thứ tự client muốn đánh số (ảnh đầu = start). Chạy trong 1
 * transaction để tất cả cùng đổi hoặc cùng không (tránh nửa vời khi lỗi giữa chừng).
 */
export async function bulkRenameAssets(
  ctx: Ctx,
  ids: string[],
  opts: { baseName: string; start?: number; pad?: number },
): Promise<{ renamed: number }> {
  const base = sanitizeFileName(opts.baseName);
  if (!base) throw new Error("Tên gốc không hợp lệ");
  const start = Number.isFinite(opts.start) ? Math.trunc(opts.start as number) : 1;
  const pad = opts.pad && opts.pad > 0 ? opts.pad : 0;

  // Lấy tên hiện tại để giữ đuôi file; chỉ ảnh thuộc workspace mới hợp lệ.
  const owned = await prisma.asset.findMany({
    where: { id: { in: ids }, workspaceId: ctx.workspaceId },
    select: { id: true, fileName: true },
  });
  const nameById = new Map(owned.map((a) => [a.id, a.fileName]));

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let n = start;
  for (const id of ids) {
    const current = nameById.get(id);
    if (current === undefined) continue; // id lạ / không thuộc workspace → bỏ qua
    const num = pad > 0 ? String(n).padStart(pad, "0") : String(n);
    const fileName = sanitizeFileName(`${base}-${num}${fileExt(current)}`);
    updates.push(prisma.asset.update({ where: { id }, data: { fileName } }));
    n++;
  }
  if (updates.length === 0) throw new Error("Không có ảnh hợp lệ để đổi tên");

  await prisma.$transaction(updates);
  await logActivity(ctx, "asset.bulk_rename", "workspace", ctx.workspaceId, {
    count: updates.length,
    base,
  });
  return { renamed: updates.length };
}

export async function softDeleteAsset(ctx: Ctx, id: string): Promise<void> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  await prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  await logActivity(ctx, "asset.delete", "asset", id);
}

export async function restoreAsset(ctx: Ctx, id: string): Promise<void> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  await prisma.asset.update({ where: { id }, data: { deletedAt: null } });
  await logActivity(ctx, "asset.restore", "asset", id);
}

type AssetWithParts = Prisma.AssetGetPayload<{ include: { parts: true } }>;

/**
 * Xóa THẬT dữ liệu lưu trữ của 1 asset (Telegram deleteMessage + Blob + file local)
 * rồi xóa row DB (StoragePart/AlbumAsset/Share tự cascade). Storage xóa best-effort:
 * lỗi 1 part không chặn việc xóa row — tránh kẹt khi làm hàng loạt.
 */
async function purgeAssetData(asset: AssetWithParts): Promise<void> {
  for (const part of asset.parts) {
    if (part.backend === "TELEGRAM") {
      await telegramDriver
        .delete({
          id: part.id,
          backend: "TELEGRAM",
          tgChatId: part.tgChatId,
          tgMessageId: part.tgMessageId,
          tgFileId: part.tgFileId,
        })
        .catch((e) => console.warn(`[purge] deleteMessage lỗi: ${e?.message ?? e}`));
    }
    if (part.blobUrl)
      await deleteBlob(part.blobUrl).catch((e) => console.warn(`[purge] blob lỗi: ${e?.message ?? e}`));
  }
  if (asset.stagingUrl?.startsWith("http"))
    await deleteBlob(asset.stagingUrl).catch((e) => console.warn(`[purge] staging lỗi: ${e?.message ?? e}`));
  await removeAssetLocalData(asset.id).catch(() => {});
  await prisma.asset.delete({ where: { id: asset.id } });
}

/** Xóa THẬT: deleteMessage trên Telegram + xóa file local + xóa row. */
export async function hardDeleteAsset(ctx: Ctx, id: string): Promise<void> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  await purgeAssetData(asset);
  await logActivity(ctx, "asset.purge", "asset", id, { fileName: asset.fileName });
}

/** Số ảnh mỗi lần "Xóa toàn bộ" — nhỏ để không chạm giới hạn thời gian serverless. */
export const PURGE_BATCH = 25;

/**
 * Xóa VĨNH VIỄN 1 lô ảnh (mọi trạng thái, kể cả trong Thùng rác) của workspace.
 * Client gọi lặp lại tới khi `remaining === 0` để chạy được với thư viện lớn mà
 * không timeout, đồng thời hiển thị được tiến độ.
 */
export async function purgeAllAssets(
  ctx: Ctx,
  limit = PURGE_BATCH,
): Promise<{ purged: number; failed: number; remaining: number }> {
  const batch = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { parts: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let purged = 0;
  let failed = 0;
  for (const asset of batch) {
    try {
      await purgeAssetData(asset);
      purged++;
    } catch (e) {
      failed++;
      console.warn(`[purge-all] asset ${asset.id} lỗi: ${e instanceof Error ? e.message : e}`);
    }
  }

  const remaining = await prisma.asset.count({ where: { workspaceId: ctx.workspaceId } });
  if (purged > 0)
    await logActivity(ctx, "asset.purge_all", "workspace", ctx.workspaceId, { purged, failed });
  return { purged, failed, remaining };
}

export async function retryAsset(ctx: Ctx, id: string): Promise<void> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");
  await prisma.asset.update({ where: { id }, data: { status: "PENDING", errorMessage: null } });
  await processAssetNow(id); // inline — đọc lại bytes từ stagingUrl (Blob/đĩa)
  await logActivity(ctx, "asset.reprocess", "asset", id);
}

export async function workspaceStats(ctx: Ctx) {
  const [count, favorites, trash, size] = await Promise.all([
    prisma.asset.count({ where: { workspaceId: ctx.workspaceId, deletedAt: null } }),
    prisma.asset.count({
      where: { workspaceId: ctx.workspaceId, deletedAt: null, isFavorite: true },
    }),
    prisma.asset.count({ where: { workspaceId: ctx.workspaceId, deletedAt: { not: null } } }),
    prisma.asset.aggregate({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      _sum: { size: true },
    }),
  ]);
  return { count, favorites, trash, totalBytes: size._sum.size ?? 0 };
}

/** Đuôi file gồm dấu chấm (".jpg", ".png"...) — rỗng nếu không có đuôi hợp lệ. */
function fileExt(name: string): string {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(name);
  return m ? m[0] : "";
}

function sanitizeFileName(name: string): string {
  const illegal = new Set(["/", "\\", "<", ">", ":", `"`, "|", "?", "*"]);
  let out = "";
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    out += illegal.has(ch) || code < 32 ? "_" : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 200);
}