import { PDFDocument } from "pdf-lib";
import { logError } from "../logger";

export const MAX_PAGE_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface PdfPageBlob {
  pageNumber: number;
  totalPages: number;
  blob: Blob;
  filename: string;
  sizeBytes: number;
}

export async function splitPdfFileToPages(file: File): Promise<PdfPageBlob[]> {
  try {
    const sourceBytes = await file.arrayBuffer();
    const sourcePdf = await PDFDocument.load(sourceBytes, {
      ignoreEncryption: true,
    });
    const totalPages = sourcePdf.getPageCount();

    if (totalPages === 0) {
      throw new Error("PDF ไม่มีหน้าให้แยก");
    }

    const baseName = file.name.replace(/\.pdf$/i, "") || "document";
    const pages: PdfPageBlob[] = [];

    for (let i = 0; i < totalPages; i += 1) {
      const pagePdf = await PDFDocument.create();
      const [copiedPage] = await pagePdf.copyPages(sourcePdf, [i]);
      pagePdf.addPage(copiedPage);
      const pdfBytes = await pagePdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });

      if (blob.size > MAX_PAGE_UPLOAD_BYTES) {
        throw new Error(
          `หน้า ${i + 1} มีขนาด ${(blob.size / 1024 / 1024).toFixed(2)} MB เกิน limit 4.5 MB — ลดความละเอียด PDF แล้วลองใหม่`,
        );
      }

      pages.push({
        pageNumber: i + 1,
        totalPages,
        blob,
        filename: `${baseName}-page-${i + 1}.pdf`,
        sizeBytes: blob.size,
      });
    }

    return pages;
  } catch (error) {
    logError("splitPdfFileToPages failed", error);
    throw error;
  }
}
