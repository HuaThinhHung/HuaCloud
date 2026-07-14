import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultCtx } from "@/server/context";
import { purgeAllAssets } from "@/server/services/asset.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Chuỗi người dùng phải gõ đúng để xác nhận — chống bấm nhầm. */
const CONFIRM_PHRASE = "XÓA TẤT CẢ";

const schema = z.object({ confirm: z.string() });

/**
 * Xóa VĨNH VIỄN toàn bộ ảnh của workspace theo từng lô. Client gọi lặp lại tới khi
 * `remaining === 0`. Middleware đã chặn nếu chưa đăng nhập (route không public).
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getDefaultCtx();
    const { confirm } = schema.parse(await req.json());
    if (confirm.trim() !== CONFIRM_PHRASE) {
      return NextResponse.json({ error: `Gõ đúng "${CONFIRM_PHRASE}" để xác nhận` }, { status: 400 });
    }
    return NextResponse.json(await purgeAllAssets(ctx));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Xóa toàn bộ thất bại";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
