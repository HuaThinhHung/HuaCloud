import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/**
 * Bảo vệ toàn app bằng 1 mật khẩu (APP_PASSWORD). Auth CHỈ bật khi APP_PASSWORD
 * được đặt — local để trống thì vào thẳng, bản deploy đặt mật khẩu thì phải đăng nhập.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/health",
  "/api/upload/handle", // tự verify cookie bên trong; phase upload-completed do Vercel gọi
];

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET?.trim() || password;
  const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
