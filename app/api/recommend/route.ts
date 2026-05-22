import { NextResponse } from "next/server";
import { CLIENT_ID_HEADER } from "@/lib/client-id";
import { GeminiServiceError } from "@/lib/gemini/generate-with-retry";
import { getInsuranceRecommendation } from "@/lib/gemini/file-search";
import { logError, logInfo } from "@/lib/logger";
import { buildAnswersSummary } from "@/lib/quiz";
import {
  consumeRateLimit,
  getClientIp,
  getRateLimitStatus,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const clientId = request.headers.get(CLIENT_ID_HEADER)?.trim();
    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "client id is required", code: "MISSING_CLIENT_ID" },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      answers?: Record<string, string>;
    };

    if (!body.answers || Object.keys(body.answers).length === 0) {
      return NextResponse.json(
        { ok: false, error: "answers is required" },
        { status: 400 },
      );
    }

    const ip = getClientIp(request);
    const current = await getRateLimitStatus({ clientId, ip });

    if (current.limited) {
      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMIT",
          error: `วันนี้ใช้ครบ ${current.limit} ครั้งแล้ว กรุณาลองใหม่พรุ่งนี้`,
          limit: current.limit,
          used: current.used,
          remaining: 0,
          dateKey: current.dateKey,
          rateLimit: {
            limit: current.limit,
            used: current.used,
            remaining: 0,
            dateKey: current.dateKey,
          },
        },
        { status: 429 },
      );
    }

    logInfo("POST /api/recommend", {
      answerCount: Object.keys(body.answers).length,
      remaining: current.remaining,
    });

    const answersSummary = buildAnswersSummary(body.answers);

    const result = await getInsuranceRecommendation({
      answersSummary,
    });

    const afterConsume = await consumeRateLimit({ clientId, ip });

    return NextResponse.json({
      ok: true,
      answersSummary,
      rateLimit: {
        limit: afterConsume.limit,
        used: afterConsume.used,
        remaining: afterConsume.remaining,
        dateKey: afterConsume.dateKey,
      },
      ...result,
    });
  } catch (error) {
    logError("POST /api/recommend failed", error);

    if (error instanceof GeminiServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        { status: error.httpStatus },
      );
    }

    const message =
      error instanceof Error ? error.message : "Recommendation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
