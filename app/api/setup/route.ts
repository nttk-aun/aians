import { NextResponse } from "next/server";
import { setupFileSearchStore } from "@/lib/gemini/file-search";
import { logError, logInfo } from "@/lib/logger";

export async function POST() {
  try {
    logInfo("POST /api/setup — indexing insurance PDFs");
    const state = await setupFileSearchStore();

    return NextResponse.json({
      ok: true,
      message:
        "สร้าง File Search store และ index PDF ทั้ง 4 ไฟล์เรียบร้อยแล้ว",
      storeName: state.storeName,
      documents: state.documents,
      hint: "บันทึก storeName ใน .env.local เป็น GEMINI_FILE_SEARCH_STORE_NAME เพื่อไม่ต้อง index ซ้ำ",
    });
  } catch (error) {
    logError("POST /api/setup failed", error);
    const message =
      error instanceof Error ? error.message : "Setup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { readStoreState } = await import("@/lib/gemini/store-state");
    const state = await readStoreState();

    return NextResponse.json({
      ok: true,
      indexed: Boolean(state?.storeName),
      store: state,
    });
  } catch (error) {
    logError("GET /api/setup failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to read store state" },
      { status: 500 },
    );
  }
}
