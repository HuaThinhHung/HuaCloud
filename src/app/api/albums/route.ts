import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import { createAlbum, listAlbums } from "@/server/services/album.service";

export const dynamic = "force-dynamic";

const smartQuerySchema = z
  .object({
    kind: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
    favorite: z.boolean().optional(),
    since: z.string().optional(),
    range: z.enum(["today", "7d", "30d", "this-month", "this-year"]).optional(),
  })
  .optional();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  smartQuery: smartQuerySchema,
});

export async function GET() {
  const ctx = await getDefaultCtx();
  return NextResponse.json({ albums: await listAlbums(ctx) });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getDefaultCtx();
    const body = createSchema.parse(await req.json());
    return NextResponse.json({ album: await createAlbum(ctx, body) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tạo album thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
