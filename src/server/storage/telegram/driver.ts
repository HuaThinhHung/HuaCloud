import "server-only";
import { env, isTelegramConfigured } from "@/lib/env";
import { prisma } from "@/server/db/client";
import type { HealthResult, PutResult, StorageDriver, StoragePartRef } from "../types";
import { deleteMessage, fetchFile, getChat, getMe, sendDocument, TelegramError } from "./client";
import { resolveFilePath } from "./path-cache";

/**
 * TelegramDriver — chỉ giữ ORIGINAL (docs/03 mục 5.2).
 * Quy tắc cứng: luôn sendDocument (không sendPhoto — giữ nguyên 100% bytes),
 * lưu đủ bộ ba {tgFileId, tgMessageId, tgChatId} để xóa thật được.
 */

async function pickChatId(): Promise<string> {
  const channel = await prisma.storageChannel.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { priority: "desc" },
  });
  const chatId = channel?.tgChatId ?? env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new TelegramError(
      "Chưa có storage channel — chạy `npm run telegram:setup` để lấy TELEGRAM_CHAT_ID",
      0,
    );
  }
  return chatId;
}

export const telegramDriver: StorageDriver = {
  async put({ buffer, fileName, mimeType }): Promise<PutResult> {
    const chatId = await pickChatId();
    const { tgFileId, tgMessageId } = await sendDocument(chatId, buffer, fileName, mimeType);
    return { backend: "TELEGRAM", size: buffer.length, tgChatId: chatId, tgFileId, tgMessageId };
  },

  async get(ref: StoragePartRef): Promise<ReadableStream<Uint8Array>> {
    let filePath = await resolveFilePath(ref);
    let res: Response;
    try {
      res = await fetchFile(filePath);
    } catch (e) {
      // race hiếm: path chết giữa TTL → retry đúng 1 lần với getFile tươi
      if (e instanceof TelegramError && e.code === 404) {
        filePath = await resolveFilePath(ref, true);
        res = await fetchFile(filePath);
      } else {
        throw e;
      }
    }
    if (!res.body) throw new TelegramError("Response không có body", 500);
    return res.body;
  },

  async delete(ref: StoragePartRef): Promise<void> {
    if (ref.tgChatId && ref.tgMessageId != null) {
      await deleteMessage(ref.tgChatId, ref.tgMessageId);
    }
  },

  async healthcheck(): Promise<HealthResult> {
    try {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return { ok: false, error: "TELEGRAM_BOT_TOKEN chưa được cấu hình" };
      }
      const me = await getMe();
      if (!isTelegramConfigured()) {
        return {
          ok: false,
          botUsername: me.username,
          error: "TELEGRAM_CHAT_ID chưa có — chạy `npm run telegram:setup`",
        };
      }
      const chat = await getChat(env.TELEGRAM_CHAT_ID);
      return { ok: true, botUsername: me.username, chatTitle: chat.title ?? chat.type };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "unknown" };
    }
  },
};
