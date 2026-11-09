import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { requireTestDatabaseUrl } from "./scripts/test-database.mjs";

requireTestDatabaseUrl(process.env.AFCS_TEST_DATABASE_URL);

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/db/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { shuffle: true, seed: 32 },
  },
});
