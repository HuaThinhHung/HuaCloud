export type AlbumDTO = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  count: number;
  isSmart: boolean;
  smartQuery: SmartQuery | null;
  createdAt: string;
};

/** Bộ lọc lưu trong album thông minh (isSmart). */
export type SmartQuery = {
  kind?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  favorite?: boolean;
  /** khoảng ngày tạo, ISO */
  since?: string;
  /** "this-month" | "last-7-days" ... — rule tương đối, ưu tiên hơn since */
  range?: "today" | "7d" | "30d" | "this-month" | "this-year";
};
