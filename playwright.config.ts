import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";
import { requireTestDatabaseUrl } from "./scripts/test-database.mjs";

loadEnvConfig(process.cwd());
const databaseUrl = requireTestDatabaseUrl(process.env.AFCS_TEST_DATABASE_URL);
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_") || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")) {
  throw new Error("Browser tests require matching Clerk development-instance keys.");
}
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  outputDir: "artifacts/e2e-results",
  reporter: [["list"], ["html", { outputFolder: "artifacts/e2e-report", open: "never" }]],
  use: { ...devices["Desktop Chrome"], channel: process.platform === "win32" ? "chrome" : undefined, baseURL, trace: process.env.CI ? "off" : "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run start -- --hostname localhost --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: databaseUrl, APP_ORIGIN: baseURL, NODE_ENV: "production" },
  },
});
