import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_GEMINI_MODEL,
  INSURANCE_PRODUCTS,
} from "../constants";
import { logError, logInfo } from "../logger";
import {
  parseStructuredRecommendation,
  type StructuredRecommendation,
} from "../recommendation-format";
import { formatAnswersForPrompt } from "../quiz";
import { resolvePdfPath } from "../pdf-path";
import { getGeminiClient } from "./client";
import { prepareAsciiUploadPath } from "./upload-pdf";
import {
  readStoreState,
  writeStoreState,
  type FileSearchStoreState,
} from "./store-state";

const POLL_MS = 4000;
const MAX_POLLS = 90;

function sleep(ms: number): Promise<void> {
  try {
    return new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    throw error;
  }
}

async function waitForOperation(
  operation: Awaited<
    ReturnType<
      ReturnType<typeof getGeminiClient>["fileSearchStores"]["uploadToFileSearchStore"]
    >
  >,
): Promise<void> {
  try {
    const ai = getGeminiClient();
    let current = operation;

    for (let i = 0; i < MAX_POLLS; i++) {
      if (current.done) return;
      await sleep(POLL_MS);
      current = await ai.operations.get({ operation: current });
      logInfo("Polling File Search operation", {
        attempt: i + 1,
        done: current.done,
      });
    }

    throw new Error("File Search operation timed out");
  } catch (error) {
    logError("waitForOperation failed", error);
    throw error;
  }
}

export async function setupFileSearchStore(): Promise<FileSearchStoreState> {
  try {
    const existing = await readStoreState();
    if (existing?.storeName) {
      logInfo("Reusing existing File Search store", {
        storeName: existing.storeName,
      });
      return existing;
    }

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

    const documents: FileSearchStoreState["documents"] = [];

    for (const product of INSURANCE_PRODUCTS) {
      const sourcePath = resolvePdfPath(product);
      const uploadPath = prepareAsciiUploadPath(product);

      logInfo("Uploading PDF to File Search store", {
        productId: product.id,
        sourcePath,
        uploadPath,
      });

      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: uploadPath,
        fileSearchStoreName: fileSearchStore.name,
        config: {
          displayName: product.storeLabel,
          mimeType: "application/pdf",
          customMetadata: [
            { key: "product_id", stringValue: product.id },
            { key: "provider_code", stringValue: product.id.split("_")[0] },
            { key: "upload_filename", stringValue: product.uploadFilename },
          ],
        },
      });

      await waitForOperation(operation);

      documents.push({
        productId: product.id,
        displayName: product.displayName,
      });
    }

    const state: FileSearchStoreState = {
      storeName: fileSearchStore.name,
      displayName,
      createdAt: new Date().toISOString(),
      documents,
    };

    await writeStoreState(state);
    return state;
  } catch (error) {
    logError("setupFileSearchStore failed", error);
    throw error;
  }
}

export async function getActiveStoreName(): Promise<string> {
  try {
    const fromEnv = process.env.GEMINI_FILE_SEARCH_STORE_NAME;
    if (fromEnv) return fromEnv;

    const state = await readStoreState();
    if (state?.storeName) return state.storeName;

    const created = await setupFileSearchStore();
    return created.storeName;
  } catch (error) {
    logError("getActiveStoreName failed", error);
    throw error;
  }
}

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
  /** ประมาณการค่าใช้จ่ายจาก totalTokenCount (อัตราปรับได้ใน .env) */
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

export async function getInsuranceRecommendation(input: {
  answersSummary: { question: string; answer: string }[];
}): Promise<RecommendationResult> {
  try {
    const storeName = await getActiveStoreName();
    const ai = getGeminiClient();

    const answerLines = formatAnswersForPrompt(input.answersSummary);

    const productLines = INSURANCE_PRODUCTS.map(
      (p) => `- ${p.provider} ${p.displayName}: ${p.tagline}`,
    ).join("\n");

    const prompt = `คุณเป็นที่ปรึกษาประกันกลุ่มมืออาชีพภาษาไทย

ข้อมูลจากแบบสอบถามผู้ใช้:
${answerLines}

แผนประกันกลุ่มที่ต้องเปรียบเทียบ (อ่านจาก File Search เท่านั้น):
${productLines}

productId ที่ใช้ได้: mt_sme, aia_gpa, vir_se, chubb_smart

งานของคุณ:
1. ค้นหาและอ่านเอกสารใน File Search
2. เลือกแผนหลัก 1 แผน และแผนสำรอง 1 แผน
3. ตอบเป็น JSON เท่านั้น (ไม่มีข้อความนอก JSON ไม่มี markdown)

รูปแบบ JSON ที่ต้องใช้:
{
  "summaryOneLine": "ประโยคสรุปสั้นๆ ว่าเหมาะกับแผนไหน",
  "primary": {
    "productId": "mt_sme",
    "provider": "ชื่อบริษัท",
    "planName": "ชื่อแผน",
    "whySuitable": ["เหตุผล 1", "เหตุผล 2", "เหตุผล 3"],
    "coverage": ["ความคุ้มครอง 1", "ความคุ้มครอง 2", "ความคุ้มครอง 3"]
  },
  "alternative": {
    "productId": "aia_gpa",
    "provider": "...",
    "planName": "...",
    "whySuitable": ["..."],
    "coverage": ["..."]
  },
  "considerations": ["ข้อควรพิจารณา 1", "ข้อควรพิจารณา 2"]
}

กฎสำคัญ:
- whySuitable อย่างน้อย 2 ข้อ อธิบายว่าทำไมเหมาะกับคำตอบแบบสอบถาม
- coverage อย่างน้อย 3 ข้อ จากเอกสารจริง (เบี้ย ผลประโยชน์ เงื่อนไข)
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร ถ้าไม่พบให้เขียน "ไม่พบในเอกสาร" ในข้อนั้น`;

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
