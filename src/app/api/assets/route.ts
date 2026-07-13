import { NextRequest, NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { listAssets, type SortKey } from "@/server/services/asset.service";
import { ASSET_KIND, type AssetKind } from "@/types/asset";

export const dynamic = "force-dynamic";

const SORTS: SortKey[] = ["new", "old", "name", "size"];

export async function GET(req: NextRequest) {
  const ctx = await getDefaultCtx();
  const sp = req.nextUrl.searchParams;

  const view = (sp.get("view") ?? "all") as "all" | "favorites" | "trash";
  const kindParam = sp.get("kind");
  const kind =
    kindParam && (ASSET_KIND as readonly string[]).includes(kindParam)
      ? (kindParam as AssetKind)
      : undefined;
  const sortParam = sp.get("sort");
  const sort = sortParam && SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined;

  const result = await listAssets(ctx, {
    cursor: sp.get("cursor"),
    take: sp.get("take") ? Number(sp.get("take")) : undefined,
    q: sp.get("q") ?? undefined,
    view: ["all", "favorites", "trash"].includes(view) ? view : "all",
    kind,
    sort,
    albumId: sp.get("albumId") ?? undefined,
    noAlbum: sp.get("noAlbum") === "1",
  });
  return NextResponse.json(result);
}
