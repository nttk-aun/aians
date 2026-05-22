import fs from "fs/promises";
import path from "path";
import type { CatalogProduct } from "../catalog";
import {
  markProductIndexed,
  resolveCatalogPdfPath,
} from "../catalog";
import { DEFAULT_EMBEDDING_MODEL } from "../constants";
import { logError, logInfo } from "../logger";
import { getWritableDataDir } from "../persistence";
import { getGeminiClient } from "./client";
import { waitForOperation } from "./operations";
import { readStoreState, writeStoreState } from "./store-state";

export async function ensureFileSearchStore(): Promise<string> {
  try {
    const fromEnv = process.env.GEMINI_FILE_SEARCH_STORE_NAME;
    if (fromEnv) return fromEnv;

    const existing = await readStoreState();
    if (existing?.storeName) return existing.storeName;

    const ai = getGeminiClient();
    const displayName = `aians-insurance-${Date.now()}`;

    const fileSearchStore = await ai.fileSearchStores.create({
      config: {
        displayName,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
      },
    });

    if (!fileSearchStore.name) {
      throw new Error("Failed to create File Search store");
    }

    await writeStoreState({
      storeName: fileSearchStore.name,
      displayName,
      createdAt: new Date().toISOString(),
      documents: [],
    });

    logInfo("Created empty File Search store", { storeName: fileSearchStore.name });
    return fileSearchStore.name;
  } catch (error) {
    logError("ensureFileSearchStore failed", error);
    throw error;
  }
}

export async function indexCatalogProduct(
  product: CatalogProduct,
): Promise<{ storeName: string }> {
  try {
    const storeName = await ensureFileSearchStore();
    const filePath = resolveCatalogPdfPath(product);

    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`PDF file not found: ${filePath}`);
    }

    const ai = getGeminiClient();

    logInfo("Indexing catalog product to Gemini File Search", {
      productId: product.id,
      filePath,
      storeName,
    });

    let operation = await ai.fileSearchStores.uploadToFileSearchStore({
      file: filePath,
      fileSearchStoreName: storeName,
      config: {
        displayName: product.storeLabel,
        mimeType: "application/pdf",
        customMetadata: [
          { key: "product_id", stringValue: product.id },
          { key: "provider", stringValue: product.provider },
          { key: "upload_filename", stringValue: product.uploadFilename },
        ],
      },
    });

    await waitForOperation(operation);

    const state = (await readStoreState()) ?? {
      storeName,
      displayName: "aians-insurance",
      createdAt: new Date().toISOString(),
      documents: [],
    };

    if (!state.documents.some((d) => d.productId === product.id)) {
      state.documents.push({
        productId: product.id,
        displayName: product.displayName,
      });
    }

    await writeStoreState(state);
    await markProductIndexed(product.id);

    logInfo("Product indexed successfully", { productId: product.id });
    return { storeName };
  } catch (error) {
    logError("indexCatalogProduct failed", error);
    throw error;
  }
}

export async function saveUploadedPdf(
  productId: string,
  uploadFilename: string,
  bytes: Buffer,
): Promise<string> {
  try {
    const pdfDir = path.join(getWritableDataDir(), "catalog-pdfs");
    await fs.mkdir(pdfDir, { recursive: true });
    const relative = path.join(".data", "catalog-pdfs", uploadFilename);
    const absolute = path.join(pdfDir, uploadFilename);
    await fs.writeFile(absolute, bytes);
    return relative;
  } catch (error) {
    logError("saveUploadedPdf failed", error);
    throw error;
  }
}
