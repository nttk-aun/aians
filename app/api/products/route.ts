import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/catalog";
import { getIndexedStatus } from "@/lib/gemini/file-search";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const products = await getCatalogProducts();
    const status = await getIndexedStatus();

    return NextResponse.json({
      ok: true,
      products: products.map((p) => ({
        id: p.id,
        provider: p.provider,
        displayName: p.displayName,
        tagline: p.tagline,
        indexedAt: p.indexedAt,
      })),
      indexed: status.indexed,
      documentCount: status.documentCount,
    });
  } catch (error) {
    logError("GET /api/products failed", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load products" },
      { status: 500 },
    );
  }
}
