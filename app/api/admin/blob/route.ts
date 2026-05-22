import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-request";
import { logError } from "@/lib/logger";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN ไม่ได้ตั้งค่า — ใน Vercel ให้สร้าง Blob store แล้ว Connect to Project",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // indexing ทำใน POST /api/admin/upload หลัง client ได้ URL
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    logError("POST /api/admin/blob failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Blob upload failed" },
      { status: 400 },
    );
  }
}
