import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/catalog";
import { getIndexedStatus } from "@/lib/gemini/file-search";
import { isAdminRequest } from "@/lib/admin-request";
import { logError } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const products = await getCatalogProducts();
    const status = await getIndexedStatus();

    return NextResponse.json({
      ok: true,
      products,
      ...status,
    });
  } catch (error) {
    logError("GET /api/admin/documents failed", error);
    return NextResponse.json({ ok: false, error: "Failed to list documents" }, { status: 500 });
  }
}
