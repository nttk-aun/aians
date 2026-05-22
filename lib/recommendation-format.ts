import type { ProductId } from "./constants";
import { logError, logInfo } from "./logger";

export interface PlanRecommendation {
  productId: ProductId | string;
  provider: string;
  planName: string;
  whySuitable: string[];
  coverage: string[];
}

export interface StructuredRecommendation {
  summaryOneLine: string;
  primary: PlanRecommendation;
  alternative?: PlanRecommendation;
  considerations?: string[];
}

function stripJsonFence(text: string): string {
  try {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fenceMatch?.[1]) return fenceMatch[1].trim();
    const inline = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (inline?.[1]) return inline[1].trim();
    return trimmed;
  } catch (error) {
    logError("stripJsonFence failed", error);
    return text;
  }
}

function normalizeStringArray(value: unknown): string[] {
  try {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch (error) {
    logError("normalizeStringArray failed", error);
    return [];
  }
}

function parsePlan(value: unknown): PlanRecommendation | null {
  try {
    if (!value || typeof value !== "object") return null;
    const p = value as Record<string, unknown>;
    const provider = typeof p.provider === "string" ? p.provider : "";
    const planName = typeof p.planName === "string" ? p.planName : "";
    const productId =
      typeof p.productId === "string" ? p.productId : "unknown";
    const whySuitable = normalizeStringArray(p.whySuitable);
    const coverage = normalizeStringArray(p.coverage);

    if (!provider || !planName) return null;

    return {
      productId,
      provider,
      planName,
      whySuitable,
      coverage,
    };
  } catch (error) {
    logError("parsePlan failed", error);
    return null;
  }
}

export function parseStructuredRecommendation(
  rawText: string,
): StructuredRecommendation | null {
  try {
    const jsonText = stripJsonFence(rawText);
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const primary = parsePlan(parsed.primary);
    if (!primary) return null;

    const summaryOneLine =
      typeof parsed.summaryOneLine === "string"
        ? parsed.summaryOneLine
        : `${primary.provider} ${primary.planName}`;

    const alternative = parsePlan(parsed.alternative) ?? undefined;
    const considerations = normalizeStringArray(parsed.considerations);

    const result: StructuredRecommendation = {
      summaryOneLine,
      primary,
      considerations: considerations.length ? considerations : undefined,
    };

    if (alternative) {
      result.alternative = alternative;
    }

    logInfo("Parsed structured recommendation", {
      primaryId: primary.productId,
      hasAlternative: Boolean(alternative),
    });

    return result;
  } catch (error) {
    logError("parseStructuredRecommendation failed", error);
    return null;
  }
}
