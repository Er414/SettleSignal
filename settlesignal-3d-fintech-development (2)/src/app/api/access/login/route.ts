import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE_SECONDS, createAccessToken, isAccessConfigured, matchesAccessPassword } from "@/server/access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Sign-in request origin was not accepted." }, { status: 403 });
  }
  if (!isAccessConfigured()) {
    return NextResponse.json({ ok: false, error: "Workspace access is not configured. Set the two SettleSignal access environment variables in Vercel and redeploy." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid sign-in request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("password" in body) || typeof body.password !== "string" || body.password.length > 4096) {
    return NextResponse.json({ ok: false, error: "Enter your workspace password." }, { status: 400 });
  }
  if (!matchesAccessPassword(body.password)) {
    return NextResponse.json({ ok: false, error: "The workspace password was not accepted." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, createAccessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}
