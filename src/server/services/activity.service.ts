import "server-only";
import { prisma } from "@/server/db/client";
import type { Ctx } from "@/server/context";

/** Audit log append-only (docs/03 mục 10.8). */
export async function logActivity(
  ctx: Ctx,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await prisma.activity
    .create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId: ctx.userId,
        actorType: "user",
        action,
        targetType,
        targetId,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
    .catch(() => {}); // audit không được làm hỏng luồng chính
}
