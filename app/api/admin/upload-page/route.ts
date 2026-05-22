import { NextResponse } from "next/server";
import { createPagedProductId } from "@/lib/admin/paged-product-id";
import { processAdminPdfPageUpload } from "@/lib/admin/process-page-upload";
import { isAdminRequest } from "@/lib/admin-request";
import { MAX_PAGE_UPLOAD_BYTES } from "@/lib/pdf/split-pdf-pages";
import { logError, logInfo } from "@/lib/logger";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const provider = String(formData.get("provider") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const tagline = String(formData.get("tagline") ?? "").trim();
    const originalFilename = String(formData.get("originalFilename") ?? "document.pdf").trim();
    const productIdInput = String(formData.get("productId") ?? "").trim();
    const pageNumber = Number(formData.get("pageNumber"));
    const totalPages = Number(formData.get("totalPages"));
    const isFirstPage = String(formData.get("isFirstPage") ?? "") === "true";
    const file = formData.get("file");

    if (!provider || !displayName || !tagline) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอก provider, displayName, tagline" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(pageNumber) || !Number.isFinite(totalPages) || pageNumber < 1 || totalPages < 1) {
      return NextResponse.json(
        { ok: false, error: "pageNumber / totalPages ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "กรุณาแนบไฟล์ PDF ของหน้านี้" },
        { status: 400 },
      );
    }

    if (file.size > MAX_PAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: `หน้า ${pageNumber} มีขนาด ${(file.size / 1024 / 1024).toFixed(2)} MB เกิน 4.5 MB`,
          code: "PAGE_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    const productId =
      productIdInput || (isFirstPage ? createPagedProductId(provider, displayName) : "");

    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "productId จำเป็นสำหรับหน้าถัดไป" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    logInfo("POST /api/admin/upload-page", {
      productId,
      pageNumber,
      totalPages,
      sizeKb: Math.round(file.size / 1024),
    });

    const result = await processAdminPdfPageUpload({
      provider,
      displayName,
      tagline,
      originalFilename,
      productId,
      pageNumber,
      totalPages,
      isFirstPage,
      bytes,
    });

    return NextResponse.json({
      ok: true,
      productId: result.product.id,
      pageNumber,
      totalPages,
      completed: result.completed,
      storeName: result.storeName,
      message: result.completed
        ? `อัปโหลดและ index ครบ ${totalPages} หน้าแล้ว`
        : `index หน้า ${pageNumber}/${totalPages} สำเร็จ`,
    });
  } catch (error) {
    logError("POST /api/admin/upload-page failed", error);
    const message =
      error instanceof Error ? error.message : "Upload page failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
