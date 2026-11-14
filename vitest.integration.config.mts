import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const database = URL.parse(process.env.AFCS_TEST_DATABASE_URL ?? "");
if (!database || !["postgres:", "postgresql:"].includes(database.protocol) || database.pathname !== "/afcs_task07_verify" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.search || database.hash) {
  throw new Error("Set AFCS_TEST_DATABASE_URL to the isolated afcs_task07_verify database.");
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/db/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { shuffle: true, seed: 32 },
  },
});
