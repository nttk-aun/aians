import fs from "fs";
import path from "path";
import type { InsuranceProduct } from "../constants";
import { logError } from "../logger";
import { getWritableDataDir } from "../persistence";
import { resolvePdfPath } from "../pdf-path";

export function prepareAsciiUploadPath(product: InsuranceProduct): string {
  try {
    const sourcePath = resolvePdfPath(product);
    const tempDir = path.join(getWritableDataDir(), "temp-uploads");
    fs.mkdirSync(tempDir, { recursive: true });

    const destPath = path.join(tempDir, product.uploadFilename);
    fs.copyFileSync(sourcePath, destPath);

    return destPath;
  } catch (error) {
    logError("prepareAsciiUploadPath failed", error);
    throw error;
  }
}
