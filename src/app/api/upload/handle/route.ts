import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, SESSION_COOKIE } from "@/lib/auth";
import { getDefaultCtx } from "@/server/context";
import { createFromBlob, MAX_FILE_BYTES } from "@/server/services/asset.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Broker cho @vercel/blob client upload — chỉ hoạt động khi DEPLOY (Vercel gọi callback).
 * Phase 1 (browser xin token): onBeforeGenerateToken — TỰ verify cookie ở đây, vì route
 *   này để "public" trong middleware (phase 2 do Vercel gọi server-to-server, không có cookie).
 * Phase 2 (Vercel báo upload xong): onUploadCompleted — tạo Asset + xử lý inline (Telegram).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!(await isAuthorized(request.cookies.get(SESSION_COOKIE)?.value))) {
          throw new Error("Chưa đăng nhập");
        }
        const payload = clientPayload
          ? (JSON.parse(clientPayload) as { fileName?: string })
          : {};
        return {
          allowedContentTypes: ["image/*", "video/*", "audio/*", "application/pdf"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ fileName: payload.fileName ?? "untitled" }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const ctx = await getDefaultCtx();
        const payload = tokenPayload
          ? (JSON.parse(tokenPayload) as { fileName?: string })
          : {};
        await createFromBlob(ctx, {
          blobUrl: blob.url,
          fileName: payload.fileName ?? blob.pathname,
          mimeType: blob.contentType ?? "application/octet-stream",
        });
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload handler lỗi";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
