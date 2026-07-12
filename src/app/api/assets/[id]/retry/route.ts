import { NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { retryAsset } from "@/server/services/asset.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getDefaultCtx();
    await retryAsset(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Retry thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
