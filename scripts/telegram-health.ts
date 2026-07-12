/* eslint-disable no-console */
// Healthcheck Telegram — KHÔNG in token.
// Chạy: npm run telegram:health
import { existsSync } from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.TG_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() || process.env.TG_CHAT_ID?.trim();

async function api<T>(method: string): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok || data.result === undefined) throw new Error(data.description ?? "unknown");
  return data.result;
}

async function main() {
  if (!TOKEN) {
    console.error("✗ TELEGRAM_BOT_TOKEN chưa có trong .env.local");
    process.exit(1);
  }
  const me = await api<{ username: string; first_name: string }>("getMe");
  console.log(`✓ Bot OK: @${me.username} (${me.first_name})`);

  if (!CHAT_ID) {
    console.warn("! TELEGRAM_CHAT_ID chưa có — chạy: npm run telegram:setup");
    process.exit(2);
  }
  const chat = await api<{ id: number; title?: string; type: string }>(
    `getChat?chat_id=${encodeURIComponent(CHAT_ID)}`,
  );
  console.log(`✓ Kho lưu trữ OK: "${chat.title ?? chat.type}" (type: ${chat.type})`);
  console.log("✓ Telegram storage sẵn sàng.");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
