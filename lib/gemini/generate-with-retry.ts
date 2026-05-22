import { logError, logInfo } from "../logger";

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 2000;

export class GeminiServiceError extends Error {
  code: string;
  retryable: boolean;
  httpStatus: number;

  constructor(
    message: string,
    options: { code: string; retryable?: boolean; httpStatus?: number },
  ) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? 503;
  }
}

function sleep(ms: number): Promise<void> {
  try {
    return new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    logError("sleep failed", error);
    return Promise.resolve();
  }
}

function parseGeminiErrorPayload(error: unknown): {
  code?: number;
  status?: string;
  message?: string;
} | null {
  try {
    if (!error || typeof error !== "object") return null;

    const err = error as {
      message?: string;
      status?: number;
      error?: { code?: number; message?: string; status?: string };
    };

    if (err.error && typeof err.error === "object") {
      return err.error;
    }

    if (typeof err.message === "string") {
      const trimmed = err.message.trim();
      if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed) as {
          error?: { code?: number; message?: string; status?: string };
        };
        return parsed.error ?? null;
      }
    }

    return null;
  } catch (error) {
    logError("parseGeminiErrorPayload failed", error);
    return null;
  }
}

export function isRetryableGeminiError(error: unknown): boolean {
  try {
    const payload = parseGeminiErrorPayload(error);
    const code = payload?.code ?? (error as { status?: number })?.status;
    const status = payload?.status;

    if (code === 429 || code === 503) return true;
    if (status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED") {
      return true;
    }

    const message =
      payload?.message ??
      (error instanceof Error ? error.message : String(error));
    return /high demand|try again|unavailable|overloaded|rate limit/i.test(
      message,
    );
  } catch (error) {
    logError("isRetryableGeminiError failed", error);
    return false;
  }
}

export function toGeminiServiceError(error: unknown): GeminiServiceError {
  try {
    const payload = parseGeminiErrorPayload(error);
    const code = payload?.code ?? (error as { status?: number })?.status;
    const status = payload?.status;
    const rawMessage =
      payload?.message ??
      (error instanceof Error ? error.message : "Gemini request failed");

    if (code === 503 || status === "UNAVAILABLE") {
      return new GeminiServiceError(
        "โมเดล AI มีผู้ใช้งานหนาแน่นชั่วคราว กรุณารอ 1–2 นาทีแล้วกดลองใหม่",
        { code: "GEMINI_UNAVAILABLE", retryable: true, httpStatus: 503 },
      );
    }

    if (code === 429 || status === "RESOURCE_EXHAUSTED") {
      return new GeminiServiceError(
        "เกินโควต้าการเรียก API ชั่วคราว กรุณาลองใหม่ในอีกสักครู่",
        { code: "GEMINI_RATE_LIMIT", retryable: true, httpStatus: 429 },
      );
    }

    return new GeminiServiceError(
      "ไม่สามารถเชื่อมต่อ Gemini ได้ กรุณาลองใหม่อีกครั้ง",
      { code: "GEMINI_ERROR", retryable: false, httpStatus: 500 },
    );
  } catch (error) {
    logError("toGeminiServiceError failed", error);
    return new GeminiServiceError("เกิดข้อผิดพลาดจาก AI", {
      code: "GEMINI_ERROR",
      httpStatus: 500,
    });
  }
}

export async function generateContentWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  try {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        if (attempt > 1) {
          logInfo("Retrying Gemini request", { context, attempt });
        }
        return await operation();
      } catch (error) {
        lastError = error;
        const retryable = isRetryableGeminiError(error);
        logError(`${context} attempt ${attempt} failed`, error);

        if (!retryable || attempt >= MAX_ATTEMPTS) {
          break;
        }

        const delayMs = RETRY_BASE_MS * 2 ** (attempt - 1);
        await sleep(delayMs);
      }
    }

    throw toGeminiServiceError(lastError);
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      throw error;
    }
    logError("generateContentWithRetry failed", error);
    throw toGeminiServiceError(error);
  }
}
