import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) return NextResponse.json({ ok: true }); // auth chưa bật

  const username = (process.env.APP_USERNAME ?? "").trim();

  let inputUser = "";
  let inputPass = "";
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    inputUser = typeof body.username === "string" ? body.username.trim() : "";
    inputPass = typeof body.password === "string" ? body.password : "";
  } catch {
    inputUser = "";
    inputPass = "";
  }

  // Nếu có đặt APP_USERNAME thì bắt buộc đúng tên; không đặt = chỉ cần mật khẩu.
  const userOk = username ? inputUser === username : true;
  const passOk = inputPass === password;
  if (!userOk || !passOk) {
    return NextResponse.json(
      { error: "Tài khoản hoặc mật khẩu không đúng" },
      { status: 401 },
    );
  }

  const secret = process.env.SESSION_SECRET?.trim() || password;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionValue(secret, username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return res;
}
