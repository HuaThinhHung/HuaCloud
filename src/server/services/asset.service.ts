import "server-only";
import { createHash } from "node:crypto";
import type { Asset, Prisma } from "@prisma/client";
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

export function toDTO(a: Asset): AssetDTO {
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
    thumbUrl: `/f/${a.id}?v=thumb`,
    previewUrl: `/f/${a.id}?v=preview`,
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
    ...albumWhere,
  };

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: sortOrderBy(params.sort),
      take: take + 1,
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

/** Xóa THẬT: deleteMessage trên Telegram + xóa file local + xóa row. */
export async function hardDeleteAsset(ctx: Ctx, id: string): Promise<void> {
  const asset = await getAssetOwned(ctx, id);
  if (!asset) throw new Error("Không tìm thấy asset");

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
        .catch((e) => console.warn(`[hard-delete] deleteMessage lỗi: ${e?.message ?? e}`));
    }
    if (part.blobUrl) await deleteBlob(part.blobUrl);
  }
  if (asset.stagingUrl?.startsWith("http")) await deleteBlob(asset.stagingUrl);
  await removeAssetLocalData(id);
  await prisma.asset.delete({ where: { id } });
  await logActivity(ctx, "asset.purge", "asset", id, { fileName: asset.fileName });
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

function sanitizeFileName(name: string): string {
  const illegal = new Set(["/", "\\", "<", ">", ":", `"`, "|", "?", "*"]);
  let out = "";
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    out += illegal.has(ch) || code < 32 ? "_" : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 200);
}