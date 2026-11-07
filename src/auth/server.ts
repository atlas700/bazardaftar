import "server-only";
import { auth } from "@clerk/nextjs/server";
import { safeServerError } from "@/diagnostics/server";

export async function getSession() {
  try {
    const { isAuthenticated, userId } = await auth();
    return isAuthenticated ? { userId } : null;
  } catch (error) { throw safeServerError("Authentication unavailable.", error); }
}

export async function requireSession() {
  try {
    const { userId } = await auth.protect();
    return { userId };
  } catch (error) { throw safeServerError("Authentication unavailable.", error); }
}
