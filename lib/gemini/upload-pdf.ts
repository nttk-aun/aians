import fs from "fs";
import path from "path";
import type { InsuranceProduct } from "../constants";
import { logError } from "../logger";
import { resolvePdfPath } from "../pdf-path";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), ".data", "temp-uploads");

export function prepareAsciiUploadPath(product: InsuranceProduct): string {
  try {
    const sourcePath = resolvePdfPath(product);
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

    const destPath = path.join(TEMP_UPLOAD_DIR, product.uploadFilename);
    fs.copyFileSync(sourcePath, destPath);

    return destPath;
  } catch (error) {
    logError("prepareAsciiUploadPath failed", error);
    throw error;
  }
}
