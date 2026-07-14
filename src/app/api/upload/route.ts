import { NextRequest, NextResponse } from "next/server";
import { getDefaultCtx } from "@/server/context";
import { addAssetsToAlbum } from "@/server/services/album.service";
import { createFromUpload, MAX_FILE_BYTES } from "@/server/services/asset.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Overhead multipart (boundary + headers) — cho dư 1MB trên MAX_FILE_BYTES.
const MAX_UPLOAD_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024;

/**
 * Upload MVP local: multipart trực tiếp vào route handler (20MB OK khi self-host).
 * Bản Vercel production: chuyển sang @vercel/blob client upload (docs/03 mục 6).
 */
export async function POST(req: NextRequest) {
  try {
    // Chặn SỚM theo content-length TRƯỚC khi đọc body vào RAM.
    // Thiếu bước này, req.formData() nạp cả file lớn vào RAM rồi mới tới
    // được check size → OOM (libvips/Node) kéo sập cả dev server.
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Giới hạn hiện tại là 20MB/file" },
        { status: 413 },
      );
    }

    const ctx = await getDefaultCtx();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Thiếu file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Giới hạn hiện tại là 20MB/file" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await createFromUpload(ctx, {
      fileName: file.name || "untitled",
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    // Upload từ trong 1 album → thêm ảnh vào album đó (best-effort, không chặn upload).
    const albumId = form.get("albumId");
    if (typeof albumId === "string" && albumId && result.asset?.id) {
      await addAssetsToAlbum(ctx, albumId, [result.asset.id]).catch((e) =>
        console.warn(`[upload] thêm vào album lỗi: ${e instanceof Error ? e.message : e}`),
      );
    }

    return NextResponse.json(result, { status: result.kind === "created" ? 201 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload thất bại";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
