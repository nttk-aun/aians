import path from "path";
import { INSURANCE_PRODUCTS } from "./constants";
import { logError, logInfo } from "./logger";
import {
  canPersistJson,
  readJsonDocument,
  REDIS_KEYS,
  writeJsonDocument,
  getWritableDataDir,
} from "./persistence";

export type ProductId = string;

export interface CatalogProduct {
  id: ProductId;
  filename: string;
  uploadFilename: string;
  storeLabel: string;
  displayName: string;
  provider: string;
  tagline: string;
  storagePath: string;
  indexedAt?: string;
  createdAt: string;
}

export interface CatalogFile {
  products: CatalogProduct[];
  updatedAt: string;
}

export const CATALOG_RELATIVE_PATH = ".data/catalog.json";
export const CATALOG_PDF_DIR = path.join(getWritableDataDir(), "catalog-pdfs");

export function slugifyId(input: string): string {
  try {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return base || `plan-${Date.now()}`;
  } catch (error) {
    logError("slugifyId failed", error);
    return `plan-${Date.now()}`;
  }
}

export function toAsciiFilename(name: string): string {
  try {
    const cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-|-$/g, "");
    return cleaned.endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
  } catch (error) {
    logError("toAsciiFilename failed", error);
    return `document-${Date.now()}.pdf`;
  }
}

async function seedDefaultCatalog(): Promise<CatalogFile> {
  try {
    const products: CatalogProduct[] = INSURANCE_PRODUCTS.map((p) => ({
      id: p.id,
      filename: p.filename,
      uploadFilename: p.uploadFilename,
      storeLabel: p.storeLabel,
      displayName: p.displayName,
      provider: p.provider,
      tagline: p.tagline,
      storagePath: path.join("public", p.filename),
      createdAt: new Date().toISOString(),
    }));

    const catalog: CatalogFile = {
      products,
      updatedAt: new Date().toISOString(),
    };

    if (canPersistJson()) {
      await writeCatalog(catalog);
    }
    return catalog;
  } catch (error) {
    logError("seedDefaultCatalog failed", error);
    throw error;
  }
}

export async function readCatalog(): Promise<CatalogFile> {
  try {
    const parsed = await readJsonDocument<CatalogFile>(
      REDIS_KEYS.catalog,
      CATALOG_RELATIVE_PATH,
    );
    if (parsed?.products?.length) return parsed;
    return seedDefaultCatalog();
  } catch (error) {
    logError("readCatalog failed", error);
    throw error;
  }
}

export async function writeCatalog(catalog: CatalogFile): Promise<void> {
  try {
    catalog.updatedAt = new Date().toISOString();
    await writeJsonDocument(
      REDIS_KEYS.catalog,
      CATALOG_RELATIVE_PATH,
      catalog,
    );
    logInfo("Catalog saved", { count: catalog.products.length });
  } catch (error) {
    logError("writeCatalog failed", error);
    throw error;
  }
}

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  try {
    const catalog = await readCatalog();
    return catalog.products;
  } catch (error) {
    logError("getCatalogProducts failed", error);
    throw error;
  }
}

export async function getProductById(
  id: string,
): Promise<CatalogProduct | undefined> {
  try {
    const products = await getCatalogProducts();
    return products.find((p) => p.id === id);
  } catch (error) {
    logError("getProductById failed", error);
    return undefined;
  }
}

export async function addCatalogProduct(
  product: CatalogProduct,
): Promise<CatalogProduct> {
  try {
    const catalog = await readCatalog();
    if (catalog.products.some((p) => p.id === product.id)) {
      throw new Error(`Product id already exists: ${product.id}`);
    }
    catalog.products.push(product);
    await writeCatalog(catalog);
    return product;
  } catch (error) {
    logError("addCatalogProduct failed", error);
    throw error;
  }
}

export async function markProductIndexed(id: string): Promise<void> {
  try {
    const catalog = await readCatalog();
    const product = catalog.products.find((p) => p.id === id);
    if (!product) return;
    product.indexedAt = new Date().toISOString();
    await writeCatalog(catalog);
  } catch (error) {
    logError("markProductIndexed failed", error);
    throw error;
  }
}

export function resolveCatalogPdfPath(product: CatalogProduct): string {
  try {
    if (path.isAbsolute(product.storagePath)) {
      return product.storagePath;
    }
    if (product.storagePath.startsWith("public/")) {
      return path.join(process.cwd(), product.storagePath);
    }
    if (product.storagePath.startsWith(".data/")) {
      const sub = product.storagePath.replace(/^\.data[\\/]/, "");
      return path.join(getWritableDataDir(), sub);
    }
    return path.join(process.cwd(), product.storagePath);
  } catch (error) {
    logError("resolveCatalogPdfPath failed", error);
    throw error;
  }
}
