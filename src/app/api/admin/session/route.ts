import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/** Lightweight cookie check for the admin UI session restore. */
export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ok: true });
}
