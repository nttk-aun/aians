import { NextResponse } from "next/server";
import { getIndexedStatus, indexAllCatalogProducts } from "@/lib/gemini/file-search";
import { logError, logInfo } from "@/lib/logger";
import { isAdminRequest } from "@/lib/admin-request";

export const maxDuration = 300;

export async function GET() {
  try {
    const status = await getIndexedStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    logError("GET /api/setup failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to read index status" },
      { status: 500 },
    );
  }
}

/** Admin only: index เอกสารใน catalog ที่ยังไม่ได้ index */
export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    logInfo("POST /api/setup — bulk index catalog");
    const result = await indexAllCatalogProducts();
    return NextResponse.json({
      ok: true,
      message: `Indexed ${result.indexed} document(s)`,
      ...result,
    });
  } catch (error) {
    logError("POST /api/setup failed", error);
    const message = error instanceof Error ? error.message : "Setup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
