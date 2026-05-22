import { logError, logInfo } from "./logger";
import { readJsonDocument, REDIS_KEYS, writeJsonDocument } from "./persistence";

const RATE_LIMIT_RELATIVE = ".data/daily-rate-limits.json";

const DEFAULT_DAILY_LIMIT = 10;
const TIMEZONE = "Asia/Bangkok";

interface RateLimitStore {
  entries: Record<string, number>;
}

export interface RateLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  dateKey: string;
  limited: boolean;
}

function getDailyLimit(): number {
  try {
    const raw = Number(process.env.DAILY_QUESTION_LIMIT ?? DEFAULT_DAILY_LIMIT);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_LIMIT;
  } catch (error) {
    logError("getDailyLimit failed", error);
    return DEFAULT_DAILY_LIMIT;
  }
}

export function getTodayKey(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
    }).format(new Date());
  } catch (error) {
    logError("getTodayKey failed", error);
    return new Date().toISOString().slice(0, 10);
  }
}

function buildStoreKey(dateKey: string, type: "client" | "ip", id: string): string {
  try {
    return `${dateKey}:${type}:${id}`;
  } catch (error) {
    throw error;
  }
}

async function readStore(): Promise<RateLimitStore> {
  try {
    const parsed = await readJsonDocument<RateLimitStore>(
      REDIS_KEYS.rateLimits,
      RATE_LIMIT_RELATIVE,
    );
    if (parsed?.entries && typeof parsed.entries === "object") {
      return parsed;
    }
    return { entries: {} };
  } catch (error) {
    logError("readStore rate-limit failed", error);
    throw error;
  }
}

async function writeStore(store: RateLimitStore): Promise<void> {
  try {
    const today = getTodayKey();
    const pruned: RateLimitStore = { entries: {} };
    for (const [key, count] of Object.entries(store.entries)) {
      if (key.startsWith(`${today}:`)) {
        pruned.entries[key] = count;
      }
    }
    await writeJsonDocument(
      REDIS_KEYS.rateLimits,
      RATE_LIMIT_RELATIVE,
      pruned,
    );
  } catch (error) {
    logError("writeStore rate-limit failed", error);
    throw error;
  }
}

function getCount(store: RateLimitStore, key: string): number {
  try {
    return store.entries[key] ?? 0;
  } catch (error) {
    logError("getCount failed", error);
    return 0;
  }
}

export function getClientIp(request: Request): string {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() ?? "unknown";
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    return "unknown";
  } catch (error) {
    logError("getClientIp failed", error);
    return "unknown";
  }
}

export async function getRateLimitStatus(input: {
  clientId: string;
  ip: string;
}): Promise<RateLimitStatus> {
  try {
    const limit = getDailyLimit();
    const dateKey = getTodayKey();
    const store = await readStore();

    const clientKey = buildStoreKey(dateKey, "client", input.clientId);
    const ipKey = buildStoreKey(dateKey, "ip", input.ip);

    const clientUsed = getCount(store, clientKey);
    const ipUsed = getCount(store, ipKey);
    const used = Math.max(clientUsed, ipUsed);
    const remaining = Math.max(0, limit - used);

    return {
      limit,
      used,
      remaining,
      dateKey,
      limited: remaining <= 0,
    };
  } catch (error) {
    logError("getRateLimitStatus failed", error);
    throw error;
  }
}

export async function consumeRateLimit(input: {
  clientId: string;
  ip: string;
}): Promise<RateLimitStatus> {
  try {
    const status = await getRateLimitStatus(input);
    if (status.limited) {
      logInfo("Rate limit exceeded", {
        clientId: input.clientId,
        ip: input.ip,
        used: status.used,
        limit: status.limit,
      });
      return status;
    }

    const store = await readStore();
    const dateKey = getTodayKey();
    const clientKey = buildStoreKey(dateKey, "client", input.clientId);
    const ipKey = buildStoreKey(dateKey, "ip", input.ip);

    store.entries[clientKey] = getCount(store, clientKey) + 1;
    store.entries[ipKey] = getCount(store, ipKey) + 1;

    await writeStore(store);

    const next = await getRateLimitStatus(input);
    logInfo("Rate limit consumed", {
      clientId: input.clientId,
      remaining: next.remaining,
    });
    return next;
  } catch (error) {
    logError("consumeRateLimit failed", error);
    throw error;
  }
}
