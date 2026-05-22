import path from "path";
import { logError } from "../logger";

export type PersistenceMode = "filesystem" | "redis";

export function isVercelRuntime(): boolean {
  try {
    return process.env.VERCEL === "1";
  } catch (error) {
    logError("isVercelRuntime failed", error);
    return false;
  }
}

export function hasRedisEnv(): boolean {
  try {
    const upstash =
      Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
      Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
    const kv =
      Boolean(process.env.KV_REST_API_URL) &&
      Boolean(process.env.KV_REST_API_TOKEN);
    return upstash || kv;
  } catch (error) {
    logError("hasRedisEnv failed", error);
    return false;
  }
}

export function getPersistenceMode(): PersistenceMode {
  try {
    const forced = process.env.AIANS_STORAGE?.toLowerCase();
    if (forced === "filesystem") return "filesystem";
    if (forced === "redis") return "redis";

    if (isVercelRuntime() || hasRedisEnv()) {
      return hasRedisEnv() ? "redis" : "filesystem";
    }

    return "filesystem";
  } catch (error) {
    logError("getPersistenceMode failed", error);
    return "filesystem";
  }
}

/** Writable base dir: `.data` locally, `/tmp/aians-data` on Vercel. */
export function getWritableDataDir(): string {
  try {
    if (isVercelRuntime()) {
      return path.join("/tmp", "aians-data");
    }
    return path.join(process.cwd(), ".data");
  } catch (error) {
    logError("getWritableDataDir failed", error);
    return path.join(process.cwd(), ".data");
  }
}

export function requireRedisOnVercel(): void {
  try {
    if (isVercelRuntime() && !hasRedisEnv()) {
      throw new Error(
        "บน Vercel ต้องตั้ง Upstash Redis (หรือ Vercel KV): UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — ดู .env.example",
      );
    }
  } catch (error) {
    logError("requireRedisOnVercel failed", error);
    throw error;
  }
}

export function canPersistJson(): boolean {
  try {
    if (getPersistenceMode() === "redis") return true;
    return !isVercelRuntime();
  } catch (error) {
    logError("canPersistJson failed", error);
    return false;
  }
}
