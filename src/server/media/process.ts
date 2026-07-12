import "server-only";
import sharp from "sharp";

export type ImageDerivatives = {
  width: number;
  height: number;
  takenAt: Date | null;
  thumb: Buffer;
  preview: Buffer;
  blurDataUrl: string;
  dominantColor: string;
  /** mimeType thật sự sharp xác nhận được — không tin browser */
  verifiedMime: string;
};

const FORMAT_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  heif: "image/heic",
};

/**
 * Pipeline Sharp (docs/03 mục 6): autorotate theo EXIF, thumb 320 WebP,
 * preview 1280 WebP, blur placeholder 16px, dominant color.
 * Throw nếu buffer không phải ảnh hợp lệ → caller đánh dấu asset FAILED
 * hoặc xử lý như DOCUMENT.
 */
/** ~100 megapixel — chặn decompression bomb, vẫn dư cho ảnh máy ảnh/panorama thật. */
const MAX_IMAGE_PIXELS = 100_000_000;

export async function processImage(buffer: Buffer): Promise<ImageDerivatives> {
  const base = sharp(buffer, { failOn: "error", limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("Không đọc được metadata ảnh");
  }
  if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
    throw new Error(`Ảnh quá lớn (${meta.width}×${meta.height}px) — vượt giới hạn xử lý an toàn`);
  }

  // EXIF DateTimeOriginal (nếu có)
  let takenAt: Date | null = null;
  try {
    const exifDate = meta.exif ? extractExifDate(meta.exif) : null;
    takenAt = exifDate;
  } catch {
    takenAt = null;
  }

  // TUẦN TỰ — không giữ nhiều bản bitmap giải nén cùng lúc trong RAM (đây là
  // chỗ RAM tăng đột biến làm sập server khi ảnh lớn). Dominant color tính trên
  // bản thumb đã thu nhỏ thay vì decode lại ảnh gốc → rẻ hơn nhiều.
  const thumb = await base.clone().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  const preview = await base.clone().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const blurBuf = await base.clone().resize({ width: 16, withoutEnlargement: true }).webp({ quality: 40 }).toBuffer();
  const stats = await sharp(thumb).stats();

  const d = stats.dominant;
  const dominantColor = `#${[d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  // orientation 5-8 = xoay 90° → width/height đổi chỗ sau rotate()
  const rotated = (meta.orientation ?? 1) >= 5;
  return {
    width: rotated ? meta.height : meta.width,
    height: rotated ? meta.width : meta.height,
    takenAt,
    thumb,
    preview,
    blurDataUrl: `data:image/webp;base64,${blurBuf.toString("base64")}`,
    dominantColor,
    verifiedMime: FORMAT_MIME[meta.format] ?? `image/${meta.format}`,
  };
}

/** Parse DateTimeOriginal từ EXIF buffer thô — best-effort, sai thì trả null. */
function extractExifDate(exif: Buffer): Date | null {
  const s = exif.toString("latin1");
  const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  return Number.isNaN(date.getTime()) ? null : date;
}
