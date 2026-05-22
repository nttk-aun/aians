import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-request";
import { getIndexedStatus } from "@/lib/gemini/file-search";
import { logError } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const authenticated = isAdminRequest(request);
    const indexStatus = await getIndexedStatus();

    return NextResponse.json({
      ok: true,
      authenticated,
      ...indexStatus,
    });
  } catch (error) {
    logError("GET /api/admin/session failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
