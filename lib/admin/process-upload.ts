import {
  addCatalogProduct,
  slugifyId,
  toAsciiFilename,
  type CatalogProduct,
} from "../catalog";
import { indexCatalogProduct, saveUploadedPdf } from "../gemini/index-document";
import { logError, logInfo } from "../logger";

export interface ProcessUploadInput {
  provider: string;
  displayName: string;
  tagline: string;
  originalFilename: string;
  bytes: Buffer;
}

export async function processAdminPdfUpload(
  input: ProcessUploadInput,
): Promise<{ product: CatalogProduct; storeName: string }> {
  try {
    const baseId = slugifyId(`${input.provider}-${input.displayName}`);
    const productId = `plan_${baseId}_${Date.now()}`;
    const uploadFilename = toAsciiFilename(`${baseId}.pdf`);

    const storagePath = await saveUploadedPdf(
      productId,
      uploadFilename,
      input.bytes,
    );

    const product: CatalogProduct = {
      id: productId,
      filename: input.originalFilename,
      uploadFilename,
      storeLabel: `${input.provider} ${input.displayName}`.slice(0, 80),
      displayName: input.displayName,
      provider: input.provider,
      tagline: input.tagline,
      storagePath,
      createdAt: new Date().toISOString(),
    };

    await addCatalogProduct(product);

    logInfo("Admin upload: indexing to Gemini File Search", { productId });
    const { storeName } = await indexCatalogProduct(product);

    return { product, storeName };
  } catch (error) {
    logError("processAdminPdfUpload failed", error);
    throw error;
  }
}

export async function fetchPdfBytesFromUrl(url: string): Promise<Buffer> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ดาวน์โหลด PDF จาก Blob ไม่สำเร็จ (HTTP ${res.status})`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (
      contentType &&
      !contentType.includes("pdf") &&
      !contentType.includes("octet-stream")
    ) {
      throw new Error(`ไฟล์จาก Blob ไม่ใช่ PDF (${contentType})`);
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    logError("fetchPdfBytesFromUrl failed", error);
    throw error;
  }
}
