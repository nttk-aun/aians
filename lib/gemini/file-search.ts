import { DEFAULT_GEMINI_MODEL } from "../constants";
import { getCatalogProducts } from "../catalog";
import { logError, logInfo } from "../logger";
import {
  parseStructuredRecommendation,
  type StructuredRecommendation,
} from "../recommendation-format";
import { formatAnswersForPrompt } from "../quiz";
import { getGeminiClient } from "./client";
import { ensureFileSearchStore } from "./index-document";
import { readStoreState } from "./store-state";

export interface CitationItem {
  title?: string;
  text?: string;
  pageNumber?: number;
  productId?: string;
}

export interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
  estimatedCostUsd?: number;
  estimatedCostThb?: number;
  costRateUsdPer1M?: number;
  costRateThbPerUsd?: number;
}

function getCostRates(): { usdPer1M: number; thbPerUsd: number } {
  try {
    const usdPer1M = Number(process.env.GEMINI_USD_PER_1M_TOKENS ?? "1");
    const thbPerUsd = Number(process.env.THB_PER_USD ?? "35");
    return {
      usdPer1M: Number.isFinite(usdPer1M) && usdPer1M > 0 ? usdPer1M : 1,
      thbPerUsd: Number.isFinite(thbPerUsd) && thbPerUsd > 0 ? thbPerUsd : 35,
    };
  } catch (error) {
    logError("getCostRates failed", error);
    return { usdPer1M: 1, thbPerUsd: 35 };
  }
}

export function estimateTokenCost(usage: TokenUsage): TokenUsage {
  try {
    const { usdPer1M, thbPerUsd } = getCostRates();
    const estimatedCostUsd =
      (usage.totalTokenCount / 1_000_000) * usdPer1M;
    const estimatedCostThb = estimatedCostUsd * thbPerUsd;

    return {
      ...usage,
      estimatedCostUsd,
      estimatedCostThb,
      costRateUsdPer1M: usdPer1M,
      costRateThbPerUsd: thbPerUsd,
    };
  } catch (error) {
    logError("estimateTokenCost failed", error);
    return usage;
  }
}

export interface RecommendationResult {
  recommendation: string;
  structured: StructuredRecommendation | null;
  citations: CitationItem[];
  model: string;
  usage?: TokenUsage;
}

function parseTokenUsage(
  response: Awaited<
    ReturnType<ReturnType<typeof getGeminiClient>["models"]["generateContent"]>
  >,
): TokenUsage | undefined {
  try {
    const meta = response.usageMetadata;
    if (!meta) return undefined;

    const usage: TokenUsage = {
      promptTokenCount: meta.promptTokenCount ?? 0,
      candidatesTokenCount: meta.candidatesTokenCount ?? 0,
      totalTokenCount: meta.totalTokenCount ?? 0,
    };

    if (meta.cachedContentTokenCount != null) {
      usage.cachedContentTokenCount = meta.cachedContentTokenCount;
    }
    if (meta.thoughtsTokenCount != null) {
      usage.thoughtsTokenCount = meta.thoughtsTokenCount;
    }
    if (meta.toolUsePromptTokenCount != null) {
      usage.toolUsePromptTokenCount = meta.toolUsePromptTokenCount;
    }

    const withCost = estimateTokenCost(usage);
    logInfo("Gemini token usage", {
      ...withCost,
      estimatedCostUsd: withCost.estimatedCostUsd?.toFixed(6),
      estimatedCostThb: withCost.estimatedCostThb?.toFixed(4),
    });
    return withCost;
  } catch (error) {
    logError("parseTokenUsage failed", error);
    return undefined;
  }
}

export async function getActiveStoreName(): Promise<string | null> {
  try {
    const fromEnv = process.env.GEMINI_FILE_SEARCH_STORE_NAME;
    if (fromEnv) return fromEnv;

    const state = await readStoreState();
    if (state?.storeName && state.documents.length > 0) {
      return state.storeName;
    }

    return null;
  } catch (error) {
    logError("getActiveStoreName failed", error);
    throw error;
  }
}

export async function getIndexedStatus(): Promise<{
  indexed: boolean;
  documentCount: number;
  storeName: string | null;
}> {
  try {
    const state = await readStoreState();
    const storeName = state?.storeName ?? null;
    const documentCount = state?.documents.length ?? 0;
    return {
      indexed: Boolean(storeName && documentCount > 0),
      documentCount,
      storeName,
    };
  } catch (error) {
    logError("getIndexedStatus failed", error);
    throw error;
  }
}

export async function getInsuranceRecommendation(input: {
  answersSummary: { question: string; answer: string }[];
}): Promise<RecommendationResult> {
  try {
    const storeName = await getActiveStoreName();
    if (!storeName) {
      throw new Error(
        "ยังไม่มีเอกสารประกันในระบบ กรุณาให้ผู้ดูแลอัปโหลดและ index ที่หน้า /admin",
      );
    }

    const products = await getCatalogProducts();
    const ai = getGeminiClient();
    const answerLines = formatAnswersForPrompt(input.answersSummary);

    const productLines = products
      .map((p) => `- ${p.provider} ${p.displayName}: ${p.tagline}`)
      .join("\n");

    const productIds = products.map((p) => p.id).join(", ");

    const prompt = `คุณเป็นที่ปรึกษาประกันกลุ่มมืออาชีพภาษาไทย

ข้อมูลจากแบบสอบถามผู้ใช้:
${answerLines}

แผนประกันกลุ่มที่ต้องเปรียบเทียบ (อ่านจาก File Search เท่านั้น):
${productLines}

productId ที่ใช้ได้: ${productIds}

งานของคุณ:
1. ค้นหาและอ่านเอกสารใน File Search
2. เลือกแผนหลัก 1 แผน และแผนสำรอง 1 แผน
3. ตอบเป็น JSON เท่านั้น (ไม่มีข้อความนอก JSON ไม่มี markdown)

รูปแบบ JSON ที่ต้องใช้:
{
  "summaryOneLine": "ประโยคสรุปสั้นๆ ว่าเหมาะกับแผนไหน",
  "primary": {
    "productId": "id จากรายการ",
    "provider": "ชื่อบริษัท",
    "planName": "ชื่อแผน",
    "whySuitable": ["เหตุผล 1", "เหตุผล 2", "เหตุผล 3"],
    "coverage": ["ความคุ้มครอง 1", "ความคุ้มครอง 2", "ความคุ้มครอง 3"]
  },
  "alternative": {
    "productId": "id จากรายการ",
    "provider": "...",
    "planName": "...",
    "whySuitable": ["..."],
    "coverage": ["..."]
  },
  "considerations": ["ข้อควรพิจารณา 1", "ข้อควรพิจารณา 2"]
}

กฎสำคัญ:
- whySuitable อย่างน้อย 2 ข้อ
- coverage อย่างน้อย 3 ข้อ จากเอกสารจริง
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร`;

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [storeName],
            },
          },
        ],
      },
    });

    const text =
      response.text ??
      "ไม่สามารถสร้างคำแนะนำได้ กรุณาลองใหม่อีกครั้ง";

    const citations: CitationItem[] = [];
    const grounding = response.candidates?.[0]?.groundingMetadata;

    if (grounding?.groundingChunks) {
      for (const chunk of grounding.groundingChunks) {
        const ctx = chunk.retrievedContext;
        if (!ctx) continue;

        let productId: string | undefined;
        if (ctx.customMetadata) {
          const meta = ctx.customMetadata.find(
            (m) => m.key === "product_id",
          );
          productId = meta?.stringValue;
        }

        citations.push({
          title: ctx.title,
          text: ctx.text?.slice(0, 280),
          pageNumber: ctx.pageNumber,
          productId,
        });
      }
    }

    const usage = parseTokenUsage(response);
    const structured = parseStructuredRecommendation(text);

    return {
      recommendation: text,
      structured,
      citations,
      model: DEFAULT_GEMINI_MODEL,
      usage,
    };
  } catch (error) {
    logError("getInsuranceRecommendation failed", error);
    throw error;
  }
}

/** สำหรับ index ชุดเริ่มต้น (legacy public PDF ใน catalog) */
export async function indexAllCatalogProducts(): Promise<{
  indexed: number;
  storeName: string;
}> {
  try {
    await ensureFileSearchStore();
    const products = await getCatalogProducts();
    const state = await readStoreState();
    const indexedIds = new Set(state?.documents.map((d) => d.productId) ?? []);

    const { indexCatalogProduct } = await import("./index-document");
    let indexed = 0;

    for (const product of products) {
      if (indexedIds.has(product.id)) continue;
      await indexCatalogProduct(product);
      indexed += 1;
    }

    const finalState = await readStoreState();
    return {
      indexed,
      storeName: finalState?.storeName ?? "",
    };
  } catch (error) {
    logError("indexAllCatalogProducts failed", error);
    throw error;
  }
}
