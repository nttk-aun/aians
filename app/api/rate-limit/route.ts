import { NextResponse } from "next/server";
import { CLIENT_ID_HEADER } from "@/lib/client-id";
import { logError } from "@/lib/logger";
import { getClientIp, getRateLimitStatus } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const clientId = request.headers.get(CLIENT_ID_HEADER)?.trim();
    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "client id is required" },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const status = await getRateLimitStatus({ clientId, ip });

    return NextResponse.json({
      ok: true,
      ...status,
      message: `วันนี้ใช้ไป ${status.used}/${status.limit} ครั้ง (เหลือ ${status.remaining} ครั้ง)`,
    });
  } catch (error) {
    logError("GET /api/rate-limit failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to read rate limit" },
      { status: 500 },
    );
  }
}
