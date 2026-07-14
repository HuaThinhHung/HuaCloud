import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import { bulkRenameAssets } from "@/server/services/asset.service";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  baseName: z.string().min(1).max(100),
  start: z.number().int().min(0).max(1_000_000).optional(),
  pad: z.number().int().min(0).max(6).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await getDefaultCtx();
    const { ids, baseName, start, pad } = schema.parse(await req.json());
    return NextResponse.json(await bulkRenameAssets(ctx, ids, { baseName, start, pad }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Đổi tên hàng loạt thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
