import fs from "fs/promises";
import path from "path";
import { STORE_STATE_PATH } from "../constants";
import { logError, logInfo } from "../logger";

export interface FileSearchStoreState {
  storeName: string;
  displayName: string;
  createdAt: string;
  documents: { productId: string; displayName: string }[];
}

export async function readStoreState(): Promise<FileSearchStoreState | null> {
  try {
    const raw = await fs.readFile(STORE_STATE_PATH, "utf-8");
    return JSON.parse(raw) as FileSearchStoreState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    logError("readStoreState failed", error);
    throw error;
  }
}

export async function writeStoreState(
  state: FileSearchStoreState,
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_STATE_PATH), { recursive: true });
    await fs.writeFile(STORE_STATE_PATH, JSON.stringify(state, null, 2));
    logInfo("File Search store state saved", { storeName: state.storeName });
  } catch (error) {
    logError("writeStoreState failed", error);
    throw error;
  }
}

export function resolveStoreName(): string | null {
  try {
    return process.env.GEMINI_FILE_SEARCH_STORE_NAME ?? null;
  } catch (error) {
    logError("resolveStoreName failed", error);
    return null;
  }
}
