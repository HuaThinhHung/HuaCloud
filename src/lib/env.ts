import { z } from "zod";

/**
 * Env validate bằng Zod — thiếu var bắt buộc thì fail ngay lúc boot
 * (bài học từ repo tham khảo: thiếu BASIC_USER → admin mở toang không cảnh báo).
 *
 * TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID là tên chính (theo yêu cầu owner);
 * TG_BOT_TOKEN/TG_CHAT_ID (tên trong docs/03) được chấp nhận như alias.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(), // Neon direct (không -pooler) cho prisma migrate
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_BLOB_ENABLED: z.string().optional(),
  // Bảo vệ truy cập (đặt khi deploy; để trống ở local = không cần đăng nhập)
  APP_USERNAME: z.string().optional(), // tên tài khoản; để trống = chỉ cần mật khẩu
  APP_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  // Cloud storage cho thumbnail/preview khi deploy (Vercel Blob)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

const raw = envSchema.parse(process.env);

// Guard production (Vercel): thiếu mật khẩu = app mở toang public → từ chối chạy.
if (process.env.VERCEL && (!raw.APP_PASSWORD?.trim() || !raw.SESSION_SECRET?.trim())) {
  throw new Error(
    "Thiếu APP_PASSWORD/SESSION_SECRET trên production — dừng để không mở app ra public.",
  );
}

export const env = {
  ...raw,
  TELEGRAM_BOT_TOKEN:
    raw.TELEGRAM_BOT_TOKEN?.trim() || process.env.TG_BOT_TOKEN?.trim() || "",
  TELEGRAM_CHAT_ID:
    raw.TELEGRAM_CHAT_ID?.trim() || process.env.TG_CHAT_ID?.trim() || "",
};

export const isTelegramConfigured = () =>
  env.TELEGRAM_BOT_TOKEN.length > 0 && env.TELEGRAM_CHAT_ID.length > 0;

export const isAiConfigured = () => (env.GEMINI_API_KEY ?? "").length > 0;

export const isAuthEnabled = () => (env.APP_PASSWORD ?? "").trim().length > 0;

export const isBlobConfigured = () => (env.BLOB_READ_WRITE_TOKEN ?? "").length > 0;
