import fs from "fs";
import path from "path";
import type { InsuranceProduct } from "./constants";
import { getPublicPdfPath } from "./constants";
import { logError, logInfo } from "./logger";

function matchPdfFile(
  product: InsuranceProduct,
  filename: string,
): boolean {
  try {
    const lower = filename.toLowerCase();
    if (filename === product.filename) return true;
    if (lower === product.uploadFilename.toLowerCase()) return true;

    switch (product.id) {
      case "mt_sme":
        return lower.includes("smesmile");
      case "aia_gpa":
        return lower.includes("gpacontinental");
      case "vir_se":
        return lower.includes("[vir]_se") || lower.endsWith("_se.pdf");
      case "chubb_smart":
        return lower.includes("groupsmart");
      default:
        return false;
    }
  } catch (error) {
    logError("matchPdfFile failed", error);
    return false;
  }
}

export function resolvePdfPath(product: InsuranceProduct): string {
  try {
    const direct = getPublicPdfPath(product.filename);
    if (fs.existsSync(direct)) {
      return direct;
    }

    const publicDir = path.join(process.cwd(), "public");
    const files = fs.readdirSync(publicDir).filter((f) => f.endsWith(".pdf"));

    const matched = files.find((f) => matchPdfFile(product, f));
    if (!matched) {
      throw new Error(
        `PDF not found for ${product.id}. Expected ${product.filename}`,
      );
    }

    const resolved = path.join(publicDir, matched);
    logInfo("Resolved PDF path", {
      productId: product.id,
      resolved,
    });
    return resolved;
  } catch (error) {
    logError("resolvePdfPath failed", error);
    throw error;
  }
}
