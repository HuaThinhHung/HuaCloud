/* eslint-disable no-console */
// Seed workspace/user mặc định + StorageChannel từ env.
// Chạy: npm run db:seed (tsx tự chạy; env đọc từ .env.local qua process.loadEnvFile)
import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), f);
  if (existsSync(p)) process.loadEnvFile(p);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "hung@huacloud.local" },
    update: {},
    create: { email: "hung@huacloud.local", name: "Hua Hưng", role: "admin" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "huacloud" },
    update: {},
    create: { slug: "huacloud", name: "HuaCloud" },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
  });

  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || process.env.TG_CHAT_ID?.trim();
  if (chatId) {
    await prisma.storageChannel.upsert({
      where: { tgChatId: chatId },
      update: { status: "ACTIVE" },
      create: { tgChatId: chatId, label: "HuaCloud Storage", status: "ACTIVE" },
    });
    console.log("Seeded StorageChannel for configured chat id.");
  } else {
    console.log("TELEGRAM_CHAT_ID chưa có — bỏ qua StorageChannel (chạy npm run telegram:setup).");
  }

  console.log(`Seed OK — user=${user.email} workspace=${workspace.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
