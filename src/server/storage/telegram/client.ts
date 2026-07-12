import "server-only";
import { env } from "@/lib/env";

/**
 * Fetch wrapper thuần cho Telegram Bot API — KHÔNG retry ở tầng này
 * (retry là việc của job queue — tầng client chỉ parse lỗi và throw có ngữ cảnh).
 * Token không bao giờ xuất hiện trong log/error message.
 */

export class TelegramError extends Error {
  readonly code: number;
  readonly retryAfter?: number;

  constructor(description: string, code: number, retryAfter?: number) {
    super(`Telegram API error ${code}: ${description}`);
    this.name = "TelegramError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function apiBase(): string {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new TelegramError("TELEGRAM_BOT_TOKEN chưa được cấu hình (.env.local)", 0);
  }
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
}

type TgResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } };

async function call<T>(method: string, init?: RequestInit, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${apiBase()}/${method}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok || data.result === undefined) {
    throw new TelegramError(
      data.description ?? "unknown error",
      data.error_code ?? res.status,
      data.parameters?.retry_after,
    );
  }
  return data.result;
}

export async function getMe(): Promise<{ id: number; username: string; first_name: string }> {
  return call("getMe", undefined, 15_000);
}

export async function getChat(chatId: string): Promise<{ id: number; title?: string; type: string }> {
  const params = new URLSearchParams({ chat_id: chatId });
  return call(`getChat?${params}`, undefined, 15_000);
}

export async function sendDocument(
  chatId: string,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ tgFileId: string; tgMessageId: bigint }> {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("disable_notification", "true");
  form.append(
    "document",
    new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" }),
    fileName,
  );
  const result = await call<{
    message_id: number;
    document?: { file_id: string };
    audio?: { file_id: string };
    video?: { file_id: string };
  }>("sendDocument", { method: "POST", body: form }, 55_000);

  // sendDocument với audio/video đôi khi được Telegram phân loại lại
  const fileId =
    result.document?.file_id ?? result.video?.file_id ?? result.audio?.file_id;
  if (!fileId) throw new TelegramError("Không lấy được file_id từ response", 500);
  return { tgFileId: fileId, tgMessageId: BigInt(result.message_id) };
}

export async function getFile(fileId: string): Promise<string /* file_path */> {
  const params = new URLSearchParams({ file_id: fileId });
  const result = await call<{ file_path?: string }>(`getFile?${params}`, undefined, 20_000);
  if (!result.file_path) throw new TelegramError("getFile không trả file_path", 500);
  return result.file_path;
}

/** Fetch bytes của file — trả Response để stream trực tiếp về client. */
export async function fetchFile(filePath: string): Promise<Response> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new TelegramError("Token chưa cấu hình", 0);
  const res = await fetch(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`,
    { signal: AbortSignal.timeout(55_000) },
  );
  if (!res.ok) throw new TelegramError(`fetch file thất bại (${res.status})`, res.status);
  return res;
}

export async function deleteMessage(chatId: string, messageId: bigint): Promise<void> {
  const params = new URLSearchParams({ chat_id: chatId, message_id: String(messageId) });
  try {
    await call(`deleteMessage?${params}`, undefined, 15_000);
  } catch (e) {
    // "message to delete not found" — đã xóa trước đó, coi như thành công (idempotent)
    if (e instanceof TelegramError && /not found/i.test(e.message)) return;
    throw e;
  }
}
