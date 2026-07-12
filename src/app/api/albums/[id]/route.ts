import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import { deleteAlbum, getAlbum, updateAlbum } from "@/server/services/album.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  coverAssetId: z.string().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    return NextResponse.json({ album: await getAlbum(ctx, id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Không tìm thấy album";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    const body = patchSchema.parse(await req.json());
    return NextResponse.json({ album: await updateAlbum(ctx, id, body) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cập nhật thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    await deleteAlbum(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Xóa album thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
