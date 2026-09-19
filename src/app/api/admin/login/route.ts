import { NextRequest, NextResponse } from "next/server";
import { adminCookieOptions } from "@/lib/admin-auth";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD is not configured" },
      { status: 500 },
    );
  }

  if (!body.password || body.password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "1", adminCookieOptions());
  return response;
}
