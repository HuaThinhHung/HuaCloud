import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) return NextResponse.json({ ok: true }); // auth chưa bật

  let input = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    input = typeof body.password === "string" ? body.password : "";
  } catch {
    input = "";
  }
  if (input !== password) {
    return NextResponse.json({ error: "Mật khẩu không đúng" }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET?.trim() || password;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return res;
}
