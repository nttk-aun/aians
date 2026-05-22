import { createHmac, timingSafeEqual } from "node:crypto";
import { logError } from "./logger";

export const ADMIN_COOKIE = "aians_admin_session";
const ADMIN_USERNAME = "soft";
const ADMIN_PASSWORD = "soft^2";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getSessionSecret(): string {
  try {
    return process.env.ADMIN_SESSION_SECRET ?? "aians-admin-dev-secret";
  } catch (error) {
    logError("getSessionSecret failed", error);
    return "aians-admin-dev-secret";
  }
}

export function verifyAdminCredentials(
  username: string,
  password: string,
): boolean {
  try {
    const u = username.trim();
    const p = password.trim();
    return u === ADMIN_USERNAME && p === ADMIN_PASSWORD;
  } catch (error) {
    logError("verifyAdminCredentials failed", error);
    return false;
  }
}

function signPayload(payload: string): string {
  try {
    return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  } catch (error) {
    logError("signPayload failed", error);
    throw error;
  }
}

export function createAdminSessionToken(): string {
  try {
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const payload = `${ADMIN_USERNAME}:${expiresAt}`;
    const signature = signPayload(payload);
    return Buffer.from(`${payload}:${signature}`).toString("base64url");
  } catch (error) {
    logError("createAdminSessionToken failed", error);
    throw error;
  }
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  try {
    if (!token) return false;

    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;

    const [username, expiresRaw, signature] = parts;
    const expiresAt = Number(expiresRaw);
    if (username !== ADMIN_USERNAME || !Number.isFinite(expiresAt)) {
      return false;
    }
    if (Date.now() > expiresAt) return false;

    const expected = signPayload(`${username}:${expiresAt}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  } catch (error) {
    logError("verifyAdminSessionToken failed", error);
    return false;
  }
}

export function getAdminCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  try {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    };
  } catch (error) {
    logError("getAdminCookieOptions failed", error);
    return {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    };
  }
}
