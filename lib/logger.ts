export function logInfo(message: string, meta?: Record<string, unknown>): void {
  try {
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
    console.log(`[aians] ${message}${payload}`);
  } catch (error) {
    console.error("[aians] logInfo failed", error);
  }
}

export function logError(message: string, error: unknown): void {
  try {
    console.error(`[aians] ${message}`, error);
  } catch (logErrorFailure) {
    console.error("[aians] logError failed", logErrorFailure);
  }
}
