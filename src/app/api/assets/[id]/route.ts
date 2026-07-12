import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import {
  hardDeleteAsset,
  renameAsset,
  restoreAsset,
  softDeleteAsset,
  toggleFavorite,
} from "@/server/services/asset.service";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("favorite") }),
  z.object({ action: z.literal("rename"), name: z.string().min(1).max(200) }),
  z.object({ action: z.literal("restore") }),
]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    const body = patchSchema.parse(await req.json());

    if (body.action === "favorite") {
      return NextResponse.json({ asset: await toggleFavorite(ctx, id) });
    }
    if (body.action === "rename") {
      return NextResponse.json({ asset: await renameAsset(ctx, id, body.name) });
    }
    await restoreAsset(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Thao tác thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    const hard = req.nextUrl.searchParams.get("hard") === "1";
    if (hard) await hardDeleteAsset(ctx, id);
    else await softDeleteAsset(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Xóa thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
