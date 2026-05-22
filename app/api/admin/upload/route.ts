import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-request";
import { logError } from "@/lib/logger";

/** อัปโหลดเต็มไฟล์ถูกแทนที่ด้วย /api/admin/upload-page (แยกทีละหน้า) */
export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "ใช้การอัปโหลดแบบแยกทีละหน้า — ระบบจะแยก PDF อัตโนมัติจากหน้า Admin (POST /api/admin/upload-page)",
        code: "USE_PAGE_UPLOAD",
      },
      { status: 400 },
    );
  } catch (error) {
    logError("POST /api/admin/upload failed", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
