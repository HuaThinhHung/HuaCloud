import "server-only";
import type { StorageBackend } from "@/types/asset";

/** Tham chiếu tới 1 phần dữ liệu đã lưu — đủ để get/delete mà không cần Prisma. */
export type StoragePartRef = {
  id: string;
  backend: StorageBackend;
  tgChatId?: string | null;
  tgFileId?: string | null;
  tgMessageId?: bigint | null;
  tgFilePath?: string | null;
  tgFilePathAt?: Date | null;
  localPath?: string | null;
  blobUrl?: string | null;
};

export type PutResult = {
  backend: StorageBackend;
  size: number;
  tgChatId?: string;
  tgFileId?: string;
  tgMessageId?: bigint;
  localPath?: string;
};

export type HealthResult = {
  ok: boolean;
  botUsername?: string;
  chatTitle?: string;
  error?: string;
};

export interface StorageDriver {
  put(input: { buffer: Buffer; fileName: string; mimeType: string }): Promise<PutResult>;
  /** Stream bytes về — Telegram: getFile + fetch; LOCAL: đọc file. */
  get(ref: StoragePartRef): Promise<ReadableStream<Uint8Array>>;
  delete(ref: StoragePartRef): Promise<void>;
  healthcheck(): Promise<HealthResult>;
}
