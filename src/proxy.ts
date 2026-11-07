import { authMiddleware } from "@/auth/middleware";

export default authMiddleware;

export const config = {
  matcher: ["/:path*"],
};
