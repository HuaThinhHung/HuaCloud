import { NextRequest, NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { listAssets } from "@/server/services/asset.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getDefaultCtx();
  const sp = req.nextUrl.searchParams;
  const view = (sp.get("view") ?? "all") as "all" | "favorites" | "trash";
  const result = await listAssets(ctx, {
    cursor: sp.get("cursor"),
    take: sp.get("take") ? Number(sp.get("take")) : undefined,
    q: sp.get("q") ?? undefined,
    view: ["all", "favorites", "trash"].includes(view) ? view : "all",
  });
  return NextResponse.json(result);
}
