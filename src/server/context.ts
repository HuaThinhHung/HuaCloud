import "server-only";
import { prisma } from "@/server/db/client";

export type Ctx = {
  userId: string;
  workspaceId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

const DEFAULT_EMAIL = "hung@huacloud.local";
const DEFAULT_WORKSPACE_SLUG = "huacloud";

let cached: Ctx | null = null;

/**
 * V1 local: single-user — tự đảm bảo user + workspace mặc định tồn tại.
 * Khi Better Auth vào (docs/04 Phase 0+), thay hàm này bằng session thật;
 * mọi service đã nhận ctx làm tham số đầu nên không phải sửa gì khác.
 */
export async function getDefaultCtx(): Promise<Ctx> {
  if (cached) return cached;

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_EMAIL },
    update: {},
    create: { email: DEFAULT_EMAIL, name: "Hua Hưng", role: "admin" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: {},
    create: { slug: DEFAULT_WORKSPACE_SLUG, name: "HuaCloud" },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
  });

  cached = { userId: user.id, workspaceId: workspace.id, role: "OWNER" };
  return cached;
}
