import { logError } from "../logger";

function slugifyId(input: string): string {
  try {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return base || `plan-${Date.now()}`;
  } catch (error) {
    logError("slugifyId failed", error);
    return `plan-${Date.now()}`;
  }
}

export function createPagedProductId(
  provider: string,
  displayName: string,
): string {
  try {
    const baseId = slugifyId(`${provider}-${displayName}`);
    return `plan_${baseId}_${Date.now()}`;
  } catch (error) {
    logError("createPagedProductId failed", error);
    return `plan_${Date.now()}`;
  }
}
