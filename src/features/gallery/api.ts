import type { AssetDTO, AssetListResponse } from "@/types/asset";

export type GalleryView = "all" | "favorites" | "trash";

export async function fetchAssets(params: {
  view: GalleryView;
  q?: string;
  cursor?: string | null;
}): Promise<AssetListResponse> {
  const sp = new URLSearchParams({ view: params.view });
  if (params.q) sp.set("q", params.q);
  if (params.cursor) sp.set("cursor", params.cursor);
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
