import { logError, logInfo } from "../logger";
import { getGeminiClient } from "./client";

const POLL_MS = 4000;
const MAX_POLLS = 90;

function sleep(ms: number): Promise<void> {
  try {
    return new Promise((resolve) => setTimeout(resolve, ms));
  } catch (error) {
    throw error;
  }
}

export async function waitForOperation(
  operation: Awaited<
    ReturnType<
      ReturnType<typeof getGeminiClient>["fileSearchStores"]["uploadToFileSearchStore"]
    >
  >,
): Promise<void> {
  try {
    const ai = getGeminiClient();
    let current = operation;

    for (let i = 0; i < MAX_POLLS; i++) {
      if (current.done) return;
      await sleep(POLL_MS);
      current = await ai.operations.get({ operation: current });
      logInfo("Polling File Search operation", {
        attempt: i + 1,
        done: current.done,
      });
    }

    throw new Error("File Search operation timed out");
  } catch (error) {
    logError("waitForOperation failed", error);
    throw error;
  }
}
