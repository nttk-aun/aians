import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getAdminCookieOptions,
  verifyAdminCredentials,
  ADMIN_COOKIE,
} from "@/lib/admin-auth";
import { logError, logInfo } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!body.username || !body.password) {
      return NextResponse.json(
        { ok: false, error: "username and password required" },
        { status: 400 },
      );
    }

    const username = body.username.trim();
    const password = body.password.trim();

    if (!verifyAdminCredentials(username, password)) {
      return NextResponse.json(
        { ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const token = createAdminSessionToken();
    const response = NextResponse.json({ ok: true, message: "เข้าสู่ระบบสำเร็จ" });
    response.cookies.set(ADMIN_COOKIE, token, getAdminCookieOptions());
    logInfo("Admin login success");
    return response;
  } catch (error) {
    logError("POST /api/admin/login failed", error);
    return NextResponse.json({ ok: false, error: "Login failed" }, { status: 500 });
  }
}
