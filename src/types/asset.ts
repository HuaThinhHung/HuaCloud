/**
 * Giá trị hợp lệ cho các cột String của SQLite fallback
 * (bản Postgres dùng enum thật — xem docs/03 mục 4).
 */
export const ASSET_KIND = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const;
export type AssetKind = (typeof ASSET_KIND)[number];

export const ASSET_STATUS = ["PENDING", "PROCESSING", "READY", "FAILED"] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

export const PART_VARIANT = ["ORIGINAL", "THUMB", "PREVIEW"] as const;
export type PartVariant = (typeof PART_VARIANT)[number];

export const STORAGE_BACKEND = ["TELEGRAM", "LOCAL", "R2", "BLOB"] as const;
export type StorageBackend = (typeof STORAGE_BACKEND)[number];

/** DTO trả về client — không lộ chi tiết backend (tgFileId, đường dẫn...). */
export type AssetDTO = {
  id: string;
  fileName: string;
  kind: AssetKind;
  status: AssetStatus;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  dominantColor: string | null;
  isFavorite: boolean;
  deletedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  /** URL nội bộ để hiển thị — /f/{id}?v=thumb|preview|original */
  thumbUrl: string;
  previewUrl: string;
  originalUrl: string;
};

export type AssetListResponse = {
  items: AssetDTO[];
  nextCursor: string | null;
  total: number;
};
