import "server-only";
import { prisma } from "@/server/db/client";
import type { Ctx } from "@/server/context";
import type { AlbumDTO, SmartQuery } from "@/types/album";
import { logActivity } from "./activity.service";
import { smartWhere } from "./asset.service";

type AlbumRow = {
  id: string;
  name: string;
  description: string | null;
  coverAssetId: string | null;
  isSmart: boolean;
  smartQuery: string | null;
  createdAt: Date;
};

const coverUrl = (assetId: string | null) => (assetId ? `/f/${assetId}?v=thumb` : null);

/** DTO cơ bản (count/cover album THƯỜNG). Smart album được caller tính lại. */
async function toDTO(album: AlbumRow): Promise<AlbumDTO> {
  const query = album.smartQuery ? (JSON.parse(album.smartQuery) as SmartQuery) : null;
  let count = 0;
  let cover = album.coverAssetId;

  if (!album.isSmart) {
    count = await prisma.albumAsset.count({ where: { albumId: album.id } });
    if (!cover) {
      const latest = await prisma.albumAsset.findFirst({
        where: { albumId: album.id, asset: { deletedAt: null } },
        orderBy: { addedAt: "desc" },
        select: { assetId: true },
      });
      cover = latest?.assetId ?? null;
    }
  }

  return {
    id: album.id,
    name: album.name,
    description: album.description,
    coverUrl: coverUrl(cover),
    count,
    isSmart: album.isSmart,
    smartQuery: query,
    createdAt: album.createdAt.toISOString(),
  };
}

/** Với album thông minh: đếm + lấy cover theo bộ lọc (cần ctx). */
async function fillSmart(ctx: Ctx, dto: AlbumDTO): Promise<AlbumDTO> {
  if (!dto.isSmart) return dto;
  const where = { workspaceId: ctx.workspaceId, deletedAt: null, ...smartWhere(dto.smartQuery) };
  const [count, first] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  dto.count = count;
  dto.coverUrl = coverUrl(first?.id ?? null);
  return dto;
}

export async function listAlbums(ctx: Ctx): Promise<AlbumDTO[]> {
  const albums = await prisma.album.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isSmart: "desc" }, { createdAt: "desc" }],
  });
  return Promise.all(albums.map(async (a) => fillSmart(ctx, await toDTO(a))));
}

async function getAlbumRow(ctx: Ctx, id: string): Promise<AlbumRow> {
  const album = await prisma.album.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!album) throw new Error("Không tìm thấy album");
  return album;
}

export async function getAlbum(ctx: Ctx, id: string): Promise<AlbumDTO> {
  return fillSmart(ctx, await toDTO(await getAlbumRow(ctx, id)));
}

export async function createAlbum(
  ctx: Ctx,
  input: { name: string; description?: string; smartQuery?: SmartQuery },
): Promise<AlbumDTO> {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Tên album không hợp lệ");
  const album = await prisma.album.create({
    data: {
      workspaceId: ctx.workspaceId,
      name,
      description: input.description?.trim() || null,
      isSmart: !!input.smartQuery,
      smartQuery: input.smartQuery ? JSON.stringify(input.smartQuery) : null,
    },
  });
  await logActivity(ctx, "album.create", "album", album.id, { name });
  return fillSmart(ctx, await toDTO(album));
}

export async function updateAlbum(
  ctx: Ctx,
  id: string,
  data: { name?: string; description?: string | null; coverAssetId?: string },
): Promise<AlbumDTO> {
  await getAlbumRow(ctx, id);
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const n = data.name.trim().slice(0, 120);
    if (!n) throw new Error("Tên album không hợp lệ");
    patch.name = n;
  }
  if (data.description !== undefined) patch.description = data.description?.trim() || null;
  if (data.coverAssetId !== undefined) patch.coverAssetId = data.coverAssetId;
  const album = await prisma.album.update({ where: { id }, data: patch });
  return fillSmart(ctx, await toDTO(album));
}

export async function deleteAlbum(ctx: Ctx, id: string): Promise<void> {
  await getAlbumRow(ctx, id);
  await prisma.album.delete({ where: { id } }); // AlbumAsset xóa theo cascade
  await logActivity(ctx, "album.delete", "album", id);
}

export async function addAssetsToAlbum(
  ctx: Ctx,
  albumId: string,
  assetIds: string[],
): Promise<{ added: number }> {
  const album = await getAlbumRow(ctx, albumId);
  if (album.isSmart) throw new Error("Album thông minh tự lọc, không thêm tay được");
  const valid = await prisma.asset.findMany({
    where: { id: { in: assetIds }, workspaceId: ctx.workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (valid.length) {
    await prisma.albumAsset.createMany({
      data: valid.map((a) => ({ albumId, assetId: a.id })),
      skipDuplicates: true,
    });
  }
  await logActivity(ctx, "album.add", "album", albumId, { count: valid.length });
  return { added: valid.length };
}

export async function removeAssetsFromAlbum(
  ctx: Ctx,
  albumId: string,
  assetIds: string[],
): Promise<{ removed: number }> {
  await getAlbumRow(ctx, albumId);
  const r = await prisma.albumAsset.deleteMany({ where: { albumId, assetId: { in: assetIds } } });
  return { removed: r.count };
}

/** ID các album THƯỜNG (không phải album thông minh) đang chứa 1 ảnh — cho lightbox. */
export async function getAssetAlbumIds(ctx: Ctx, assetId: string): Promise<string[]> {
  const rows = await prisma.albumAsset.findMany({
    where: { assetId, album: { workspaceId: ctx.workspaceId, isSmart: false } },
    select: { albumId: true },
  });
  return rows.map((r) => r.albumId);
}
