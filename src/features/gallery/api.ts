import type { AlbumDTO, SmartQuery } from "@/types/album";
import type { AssetDTO, AssetKind, AssetListResponse } from "@/types/asset";

export type GalleryView = "all" | "favorites" | "trash";
export type SortKey = "new" | "old" | "name" | "size";

export async function fetchAssets(params: {
  view: GalleryView;
  q?: string;
  cursor?: string | null;
  kind?: AssetKind | "";
  sort?: SortKey;
  albumId?: string;
}): Promise<AssetListResponse> {
  const sp = new URLSearchParams({ view: params.view });
  if (params.q) sp.set("q", params.q);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.kind) sp.set("kind", params.kind);
  if (params.sort) sp.set("sort", params.sort);
  if (params.albumId) sp.set("albumId", params.albumId);
  const res = await fetch(`/api/assets?${sp}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được danh sách ảnh");
  return res.json();
}

async function ok(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Lỗi ${res.status}`);
  }
  return res.json();
}

export async function toggleFavoriteApi(id: string): Promise<{ asset: AssetDTO }> {
  return ok(
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "favorite" }),
    }),
  );
}

export async function renameAssetApi(id: string, name: string): Promise<{ asset: AssetDTO }> {
  return ok(
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", name }),
    }),
  );
}

export async function restoreAssetApi(id: string): Promise<void> {
  await ok(
    await fetch(`/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    }),
  );
}

export async function deleteAssetApi(id: string, hard = false): Promise<void> {
  await ok(await fetch(`/api/assets/${id}${hard ? "?hard=1" : ""}`, { method: "DELETE" }));
}

export async function retryAssetApi(id: string): Promise<void> {
  await ok(await fetch(`/api/assets/${id}/retry`, { method: "POST" }));
}

/* ---------- Albums ---------- */

export async function fetchAlbums(): Promise<AlbumDTO[]> {
  const res = await fetch("/api/albums", { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được album");
  return (await res.json()).albums;
}

export async function fetchAlbum(id: string): Promise<AlbumDTO> {
  const res = await fetch(`/api/albums/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Không tìm thấy album");
  return (await res.json()).album;
}

export async function createAlbumApi(input: {
  name: string;
  description?: string;
  smartQuery?: SmartQuery;
}): Promise<{ album: AlbumDTO }> {
  return ok(
    await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateAlbumApi(
  id: string,
  data: { name?: string; description?: string | null; coverAssetId?: string },
): Promise<{ album: AlbumDTO }> {
  return ok(
    await fetch(`/api/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  );
}

export async function deleteAlbumApi(id: string): Promise<void> {
  await ok(await fetch(`/api/albums/${id}`, { method: "DELETE" }));
}

export async function addToAlbumApi(albumId: string, assetIds: string[]): Promise<{ added: number }> {
  return ok(
    await fetch(`/api/albums/${albumId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds }),
    }),
  );
}

export async function removeFromAlbumApi(
  albumId: string,
  assetIds: string[],
): Promise<{ removed: number }> {
  return ok(
    await fetch(`/api/albums/${albumId}/assets`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetIds }),
    }),
  );
}
