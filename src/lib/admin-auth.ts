import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/constants";

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

/** Returns a 401 response if the admin cookie is missing; otherwise null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
