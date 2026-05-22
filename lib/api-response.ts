import { logError } from "./logger";

export async function parseApiJson<T>(res: Response): Promise<T> {
  try {
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(`เซิร์ฟเวอร์ตอบว่าง (HTTP ${res.status})`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      if (text.includes("Request Entity Too Large") || text.includes("FUNCTION_PAYLOAD_TOO_LARGE")) {
        throw new Error(
          "ไฟล์ PDF ใหญ่เกิน limit ของ Vercel — ใช้การอัปโหลดผ่าน Blob (ต้องตั้ง BLOB_READ_WRITE_TOKEN) หรือกด Index แผนที่ยังค้างสำหรับไฟล์ใน public/",
        );
      }
      throw new Error(text.slice(0, 240));
    }
  } catch (error) {
    logError("parseApiJson failed", error);
    throw error;
  }
}
