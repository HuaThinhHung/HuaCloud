import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import { addAssetsToAlbum, removeAssetsFromAlbum } from "@/server/services/album.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ assetIds: z.array(z.string()).min(1).max(500) });

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    const { assetIds } = schema.parse(await req.json());
    return NextResponse.json(await addAssetsToAlbum(ctx, id, assetIds));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Thêm vào album thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    const { assetIds } = schema.parse(await req.json());
    return NextResponse.json(await removeAssetsFromAlbum(ctx, id, assetIds));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bỏ khỏi album thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
