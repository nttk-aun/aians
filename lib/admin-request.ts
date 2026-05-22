import { logError } from "./logger";
import { verifyAdminSessionToken, ADMIN_COOKIE } from "./admin-auth";

export function isAdminRequest(request: Request): boolean {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const token = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${ADMIN_COOKIE}=`))
      ?.split("=")[1];

    return verifyAdminSessionToken(token);
  } catch (error) {
    logError("isAdminRequest failed", error);
    return false;
  }
}
