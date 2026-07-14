import { NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { getAssetAlbumIds } from "@/server/services/album.service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Trả về ID các album thường đang chứa ảnh này — dùng cho toggle album trong lightbox. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await getDefaultCtx();
  return NextResponse.json({ albumIds: await getAssetAlbumIds(ctx, id) });
}
