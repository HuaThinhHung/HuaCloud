import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/env";
import { prisma } from "@/server/db/client";
import { pendingJobs } from "@/server/jobs/queue";
import { telegramDriver } from "@/server/storage/telegram/driver";

export const dynamic = "force-dynamic";

/** Diagnostics — KHÔNG trả về bất kỳ secret nào. */
export async function GET() {
  const db = await prisma.$queryRaw`SELECT 1`
    .then(() => ({ ok: true }))
    .catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : "unknown" }));

  const telegram = await telegramDriver.healthcheck();

  return NextResponse.json({
    db,
    telegram,
    ai: { configured: isAiConfigured() },
    queue: { pending: pendingJobs() },
  });
}
