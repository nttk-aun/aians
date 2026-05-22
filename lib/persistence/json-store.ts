import fs from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { logError } from "../logger";
import {
  canPersistJson,
  getPersistenceMode,
  getWritableDataDir,
  isVercelRuntime,
  requireRedisOnVercel,
} from "./config";

const REDIS_KEYS = {
  catalog: "aians:catalog",
  rateLimits: "aians:rate-limits",
  storeState: "aians:file-search-store",
} as const;

let redisClient: Redis | null = null;

function getRedis(): Redis {
  try {
    if (redisClient) return redisClient;

    const url =
      process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error("Redis env vars missing");
    }

    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    logError("getRedis failed", error);
    throw error;
  }
}

function resolveFilePath(relativePath: string): string {
  try {
    if (relativePath.startsWith(".data")) {
      const sub = relativePath.replace(/^\.data[\\/]/, "");
      return path.join(getWritableDataDir(), sub);
    }
    return path.join(process.cwd(), relativePath);
  } catch (error) {
    logError("resolveFilePath failed", error);
    throw error;
  }
}

export async function readJsonDocument<T>(
  redisKey: string,
  relativeFilePath: string,
): Promise<T | null> {
  try {
    if (getPersistenceMode() === "redis") {
      const redis = getRedis();
      const value = await redis.get<T>(redisKey);
      return value ?? null;
    }

    const filePath = resolveFilePath(relativeFilePath);
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    logError("readJsonDocument failed", { redisKey, relativeFilePath, error });
    throw error;
  }
}

export async function writeJsonDocument<T>(
  redisKey: string,
  relativeFilePath: string,
  data: T,
): Promise<void> {
  try {
    if (isVercelRuntime()) {
      requireRedisOnVercel();
    }

    if (!canPersistJson()) {
      throw new Error("JSON persistence is not available in this environment");
    }

    if (getPersistenceMode() === "redis") {
      const redis = getRedis();
      await redis.set(redisKey, data);
      return;
    }

    const filePath = resolveFilePath(relativeFilePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    logError("writeJsonDocument failed", { redisKey, relativeFilePath, error });
    throw error;
  }
}

export { REDIS_KEYS };
