import { NextResponse } from "next/server";
import {
  addCatalogProduct,
  slugifyId,
  toAsciiFilename,
  type CatalogProduct,
} from "@/lib/catalog";
import { isAdminRequest } from "@/lib/admin-request";
import { indexCatalogProduct, saveUploadedPdf } from "@/lib/gemini/index-document";
import { logError, logInfo } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const provider = String(formData.get("provider") ?? "").trim();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const tagline = String(formData.get("tagline") ?? "").trim();
    const file = formData.get("file");

    if (!provider || !displayName || !tagline) {
      return NextResponse.json(
        { ok: false, error: "กรุณากรอก provider, displayName, tagline" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "กรุณาแนบไฟล์ PDF" },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { ok: false, error: "รองรับเฉพาะไฟล์ PDF" },
        { status: 400 },
      );
    }

    const baseId = slugifyId(`${provider}-${displayName}`);
    const productId = `plan_${baseId}_${Date.now()}`;
    const uploadFilename = toAsciiFilename(`${baseId}.pdf`);
    const bytes = Buffer.from(await file.arrayBuffer());

    const storagePath = await saveUploadedPdf(productId, uploadFilename, bytes);

    const product: CatalogProduct = {
      id: productId,
      filename: file.name,
      uploadFilename,
      storeLabel: `${provider} ${displayName}`.slice(0, 80),
      displayName,
      provider,
      tagline,
      storagePath,
      createdAt: new Date().toISOString(),
    };

    await addCatalogProduct(product);

    logInfo("Admin upload: indexing to Gemini File Search", { productId });
    const { storeName } = await indexCatalogProduct(product);

    return NextResponse.json({
      ok: true,
      message: "อัปโหลดและ index ไปยัง Google File Search เรียบร้อยแล้ว",
      product,
      storeName,
    });
  } catch (error) {
    logError("POST /api/admin/upload failed", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
