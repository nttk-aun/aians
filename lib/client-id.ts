export const CLIENT_ID_HEADER = "x-aians-client-id";
export const CLIENT_ID_STORAGE_KEY = "aians_client_id";

export function getOrCreateClientId(): string {
  try {
    if (typeof window === "undefined") return "";

    let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `guest-${Date.now()}`;
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    }
    return id;
  } catch (error) {
    console.error("[aians] getOrCreateClientId failed", error);
    return `guest-${Date.now()}`;
  }
}
