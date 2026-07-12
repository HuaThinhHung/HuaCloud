import "server-only";
import { prisma } from "@/server/db/client";
import { getFile } from "./client";
import type { StoragePartRef } from "../types";

/** file_path Telegram sống ~1h — cache TTL 50 phút trong StoragePart (docs/03 mục 5.2). */
const TTL_MS = 50 * 60 * 1000;

export async function resolveFilePath(ref: StoragePartRef, forceRefresh = false): Promise<string> {
  if (!ref.tgFileId) throw new Error("StoragePart thiếu tgFileId");

  const fresh =
    !forceRefresh &&
    ref.tgFilePath &&
    ref.tgFilePathAt &&
    Date.now() - new Date(ref.tgFilePathAt).getTime() < TTL_MS;

  if (fresh) return ref.tgFilePath as string;

  const filePath = await getFile(ref.tgFileId);
  await prisma.storagePart.update({
    where: { id: ref.id },
    data: { tgFilePath: filePath, tgFilePathAt: new Date() },
  });
  return filePath;
}
