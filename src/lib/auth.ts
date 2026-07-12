/**
 * Xác thực 1 tài khoản cá nhân bằng cookie ký HMAC — chạy được cả ở middleware
 * (edge runtime) lẫn route handler (node). KHÔNG dùng Buffer/node:crypto để giữ
 * tương thích edge. Auth chỉ bật khi APP_PASSWORD được đặt; để trống thì bỏ qua.
 */

const encoder = new TextEncoder();
const SESSION_MARKER = "huacloud-session-v1";

export const SESSION_COOKIE = "hc_session";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacBase64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** So sánh chuỗi thời gian hằng số — tránh timing attack. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Giá trị cookie phiên hợp lệ, suy ra từ secret + username. Gắn username vào
 * chữ ký nghĩa là đổi tài khoản (hoặc secret) sẽ vô hiệu mọi phiên cũ.
 */
export async function sessionValue(secret: string, username = ""): Promise<string> {
  return hmacBase64Url(secret, `${SESSION_MARKER}:${username}`);
}

export async function verifySession(
  cookieValue: string | undefined,
  secret: string,
  username = "",
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await sessionValue(secret, username);
  return safeEqual(cookieValue, expected);
}

/** Auth tổng: true nếu auth đang TẮT (chưa đặt APP_PASSWORD) hoặc cookie hợp lệ. */
export async function isAuthorized(cookieValue: string | undefined): Promise<boolean> {
  const password = (process.env.APP_PASSWORD ?? "").trim();
  if (!password) return true;
  const secret = (process.env.SESSION_SECRET ?? "").trim() || password;
  const username = (process.env.APP_USERNAME ?? "").trim();
  return verifySession(cookieValue, secret, username);
}
