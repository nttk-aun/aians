import { logError, logInfo } from "../logger";
import {
  readJsonDocument,
  REDIS_KEYS,
  writeJsonDocument,
} from "../persistence";

const STORE_STATE_RELATIVE = ".data/file-search-store.json";

export interface FileSearchStoreState {
  storeName: string;
  displayName: string;
  createdAt: string;
  documents: { productId: string; displayName: string }[];
}

export async function readStoreState(): Promise<FileSearchStoreState | null> {
  try {
    return readJsonDocument<FileSearchStoreState>(
      REDIS_KEYS.storeState,
      STORE_STATE_RELATIVE,
    );
  } catch (error) {
    logError("readStoreState failed", error);
    throw error;
  }
}

export async function writeStoreState(
  state: FileSearchStoreState,
): Promise<void> {
  try {
    await writeJsonDocument(
      REDIS_KEYS.storeState,
      STORE_STATE_RELATIVE,
      state,
    );
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
