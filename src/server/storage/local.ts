import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * LOCAL storage — dev fallback cho derivatives (bản production: R2, docs/03).
 * Mọi thứ nằm dưới .data/ (đã gitignore).
 */

export const DATA_DIR = path.join(process.cwd(), ".data");
export const STAGING_DIR = path.join(DATA_DIR, "staging");
export const DERIVED_DIR = path.join(DATA_DIR, "derived");
export const ORIGINALS_DIR = path.join(DATA_DIR, "originals");

export async function ensureDataDirs(): Promise<void> {
  await Promise.all(
    [STAGING_DIR, DERIVED_DIR, ORIGINALS_DIR].map((d) => mkdir(d, { recursive: true })),
  );
}

export async function saveStagingFile(assetId: string, buffer: Buffer): Promise<string> {
  await ensureDataDirs();
  const p = path.join(STAGING_DIR, assetId);
  await writeFile(p, buffer);
  return p;
}

export async function saveDerived(
  assetId: string,
  name: "thumb.webp" | "preview.webp",
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(DERIVED_DIR, assetId);
  await mkdir(dir, { recursive: true });
  const p = path.join(dir, name);
  await writeFile(p, buffer);
  return p;
}

export async function saveLocalOriginal(assetId: string, fileName: string, buffer: Buffer): Promise<string> {
  const dir = path.join(ORIGINALS_DIR, assetId);
  await mkdir(dir, { recursive: true });
  const p = path.join(dir, fileName);
  await writeFile(p, buffer);
  return p;
}

export function localFileStream(localPath: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>;
}

export async function removeLocal(p: string | null | undefined): Promise<void> {
  if (!p) return;
  await rm(p, { force: true, recursive: true }).catch(() => {});
}

export async function removeAssetLocalData(assetId: string): Promise<void> {
  await Promise.all([
    rm(path.join(DERIVED_DIR, assetId), { recursive: true, force: true }).catch(() => {}),
    rm(path.join(ORIGINALS_DIR, assetId), { recursive: true, force: true }).catch(() => {}),
    rm(path.join(STAGING_DIR, assetId), { force: true }).catch(() => {}),
  ]);
}
