import { GoogleGenAI } from "@google/genai";
import { logError } from "../logger";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  try {
    if (cachedClient) return cachedClient;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const hint =
        process.env.VERCEL === "1"
          ? "GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy."
          : "GEMINI_API_KEY is not set. Add it to .env.local";
      throw new Error(hint);
    }

    cachedClient = new GoogleGenAI({ apiKey });
    return cachedClient;
  } catch (error) {
    logError("getGeminiClient failed", error);
    throw error;
  }
}
