/* eslint-disable no-console */
// Tự động lấy TELEGRAM_CHAT_ID và ghi vào .env.local + seed StorageChannel.
//
// Cách hoạt động: sau khi bot được add (làm admin) vào channel/group
// "HuaCloud Storage", chỉ cần đăng 1 tin nhắn bất kỳ trong đó rồi chạy script.
// Script đọc getUpdates, tìm chat phù hợp và tự cấu hình.
//
// Chạy: npm run telegram:setup            → tự dò
//       npm run telegram:setup -- -100123 → chỉ định chat id thủ công
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.TG_BOT_TOKEN?.trim();
const PREFERRED_TITLE = "huacloud storage";

type TgChat = { id: number; title?: string; type: string };

async function api<T>(method: string): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok || data.result === undefined) throw new Error(data.description ?? "unknown");
  return data.result;
}

function collectChats(updates: unknown[]): Map<number, TgChat> {
  const chats = new Map<number, TgChat>();
  for (const u of updates as Record<string, unknown>[]) {
    for (const key of ["channel_post", "message", "my_chat_member", "edited_channel_post"]) {
      const obj = u[key] as { chat?: TgChat } | undefined;
      const chat = obj?.chat;
      if (
        chat &&
        (chat.type === "channel" ||
          chat.type === "group" ||
          chat.type === "supergroup" ||
          chat.type === "private")
      ) {
        chats.set(chat.id, chat);
      }
    }
  }
  return chats;
}

function writeEnvChatId(chatId: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (/^TELEGRAM_CHAT_ID=.*$/m.test(content)) {
    content = content.replace(/^TELEGRAM_CHAT_ID=.*$/m, `TELEGRAM_CHAT_ID="${chatId}"`);
  } else {
    content += `\nTELEGRAM_CHAT_ID="${chatId}"\n`;
  }
  writeFileSync(envPath, content, "utf8");
}

async function main() {
  if (!TOKEN) {
    console.error("✗ TELEGRAM_BOT_TOKEN chưa có trong .env.local");
    process.exit(1);
  }

  const me = await api<{ username: string }>("getMe");
  console.log(`✓ Bot: @${me.username}`);

  let chatId = process.argv[2]?.trim();
  let title: string | undefined;

  if (!chatId) {
    const updates = await api<unknown[]>("getUpdates?limit=100&allowed_updates=%5B%22message%22,%22channel_post%22,%22my_chat_member%22%5D");
    const chats = collectChats(updates);

    if (chats.size === 0) {
      console.error(
        `✗ Chưa thấy chat nào.\n  1) Tạo private channel/group tên "HuaCloud Storage"\n  2) Add bot @${me.username} làm ADMIN\n  3) Gửi 1 tin nhắn bất kỳ trong đó\n  4) Chạy lại: npm run telegram:setup`,
      );
      process.exit(2);
    }

    const list = [...chats.values()];
    const preferred =
      list.find((c) => (c.title ?? "").toLowerCase() === PREFERRED_TITLE) ??
      list.find((c) => (c.title ?? "").toLowerCase().includes("huacloud")) ??
      list.find((c) => c.type !== "private") ??
      list[list.length - 1];

    console.log("  Chat tìm thấy:");
    for (const c of list) {
      console.log(`   ${c.id === preferred!.id ? "→" : " "} [${c.type}] ${c.title ?? "(không tên)"} (${c.id})`);
    }
    chatId = String(preferred!.id);
    title = preferred!.title;
  }

  // Verify quyền gửi tin
  const chat = await api<TgChat>(`getChat?chat_id=${encodeURIComponent(chatId)}`);
  title = chat.title ?? title;
  console.log(`✓ Chọn kho: "${title}" (${chatId})`);

  writeEnvChatId(chatId);
  console.log("✓ Đã ghi TELEGRAM_CHAT_ID vào .env.local");

  const prisma = new PrismaClient();
  try {
    await prisma.storageChannel.upsert({
      where: { tgChatId: chatId },
      update: { status: "ACTIVE", label: title ?? "HuaCloud Storage" },
      create: { tgChatId: chatId, label: title ?? "HuaCloud Storage", status: "ACTIVE" },
    });
    console.log("✓ Đã seed StorageChannel trong database");
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n✓ HOÀN TẤT — restart dev server (nếu đang chạy) để nhận env mới.");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
