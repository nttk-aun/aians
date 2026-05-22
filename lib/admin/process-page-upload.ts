import {
  addCatalogProduct,
  slugifyId,
  toAsciiFilename,
  markProductIndexed,
  type CatalogProduct,
} from "../catalog";
import {
  indexCatalogProductPage,
  saveUploadedPdf,
} from "../gemini/index-document";
import { logError, logInfo } from "../logger";

export interface ProcessPageUploadInput {
  provider: string;
  displayName: string;
  tagline: string;
  originalFilename: string;
  productId: string;
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  bytes: Buffer;
}

export async function processAdminPdfPageUpload(
  input: ProcessPageUploadInput,
): Promise<{ product: CatalogProduct; storeName: string; completed: boolean }> {
  try {
    let product: CatalogProduct;

    if (input.isFirstPage) {
      const baseId = slugifyId(`${input.provider}-${input.displayName}`);
      const uploadFilename = toAsciiFilename(`${baseId}.pdf`);

      product = {
        id: input.productId,
        filename: input.originalFilename,
        uploadFilename,
        storeLabel: `${input.provider} ${input.displayName}`.slice(0, 80),
        displayName: input.displayName,
        provider: input.provider,
        tagline: input.tagline,
        storagePath: "",
        createdAt: new Date().toISOString(),
      };

      await addCatalogProduct(product);
      logInfo("Catalog product created for paged upload", {
        productId: product.id,
        totalPages: input.totalPages,
      });
    } else {
      const { getProductById } = await import("../catalog");
      const existing = await getProductById(input.productId);
      if (!existing) {
        throw new Error(`ไม่พบแผน ${input.productId} — อัปโหลดหน้าแรกก่อน`);
      }
      product = existing;
    }

    const pageFilename = `${input.productId}-page-${input.pageNumber}.pdf`;
    const storagePath = await saveUploadedPdf(
      input.productId,
      pageFilename,
      input.bytes,
    );

    if (input.isFirstPage) {
      product.storagePath = storagePath;
    }

    const { storeName } = await indexCatalogProductPage({
      product,
      storagePath,
      pageNumber: input.pageNumber,
      totalPages: input.totalPages,
    });

    const completed = input.pageNumber === input.totalPages;
    if (completed) {
      await markProductIndexed(product.id);
      logInfo("Paged upload completed", {
        productId: product.id,
        totalPages: input.totalPages,
      });
    }

    return { product, storeName, completed };
  } catch (error) {
    logError("processAdminPdfPageUpload failed", error);
    throw error;
  }
}
