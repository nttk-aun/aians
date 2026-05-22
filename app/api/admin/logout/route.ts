import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { logError } from "@/lib/logger";

export async function POST() {
  try {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    logError("POST /api/admin/logout failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
