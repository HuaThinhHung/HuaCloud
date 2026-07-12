import { NextRequest, NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { getAssetOwned } from "@/server/services/asset.service";
import { localFileStream } from "@/server/storage/local";
import { telegramDriver } from "@/server/storage/telegram/driver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Serve file (docs/03 mục 7, bản local):
 * - v=thumb|preview → đọc derived local (nhanh, gallery không chạm Telegram)
 * - v=original      → TELEGRAM: stream qua getFile + cache file_path; LOCAL: đọc disk
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getDefaultCtx();
  const asset = await getAssetOwned(ctx, id);
  if (!asset) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const v = req.nextUrl.searchParams.get("v") ?? "original";
  const variant = v === "thumb" ? "THUMB" : v === "preview" ? "PREVIEW" : "ORIGINAL";
  const download = req.nextUrl.searchParams.get("download") === "1";

  let part = asset.parts.find((p) => p.variant === variant);
  // Chưa có derived (đang xử lý / file không phải ảnh) → fallback original
  if (!part && variant !== "ORIGINAL") {
    part = asset.parts.find((p) => p.variant === "ORIGINAL");
  }
  if (!part) return NextResponse.json({ error: "File chưa sẵn sàng" }, { status: 409 });

  // Thumb/preview trên Vercel Blob → 302 để CDN phục vụ, không tốn function time
  // (gallery điện thoại hit liên tục). Ảnh gốc Telegram VẪN proxy để giữ auth + giấu token.
  if (part.backend === "BLOB" && part.blobUrl) {
    return NextResponse.redirect(part.blobUrl, 302);
  }

  const headers = new Headers({
    "Content-Type": variant === "ORIGINAL" ? asset.mimeType : "image/webp",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
      variant === "ORIGINAL" ? asset.fileName : `${variant.toLowerCase()}-${asset.fileName}.webp`,
    )}`,
  });

  try {
    if (part.backend === "TELEGRAM") {
      const stream = await telegramDriver.get({
        id: part.id,
        backend: "TELEGRAM",
        tgChatId: part.tgChatId,
        tgFileId: part.tgFileId,
        tgMessageId: part.tgMessageId,
        tgFilePath: part.tgFilePath,
        tgFilePathAt: part.tgFilePathAt,
      });
      return new NextResponse(stream, { headers });
    }
    if (part.localPath) {
      headers.set("Content-Length", String(part.size));
      return new NextResponse(localFileStream(part.localPath), { headers });
    }
    return NextResponse.json({ error: "Không có nguồn dữ liệu" }, { status: 500 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Đọc file thất bại";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
