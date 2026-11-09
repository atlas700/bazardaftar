import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

const config = new URL("../../vitest.integration.config.mts", import.meta.url).href;

it.each(["", "not-a-url", "postgresql://test:secret@localhost/afcs_dev", "https://localhost/afcs_task07_verify"])(
  "refuses an absent or unsafe integration database without exposing credentials (%#)", (databaseUrl) => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(config)})`], {
      env: { ...process.env, AFCS_TEST_DATABASE_URL: databaseUrl }, encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Set AFCS_TEST_DATABASE_URL to the isolated afcs_task07_verify database.");
    expect(result.stderr).not.toContain("test:secret");
  },
);

it("accepts the explicitly selected isolated database without connecting to it", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(config)})`], {
    env: { ...process.env, AFCS_TEST_DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/afcs_task07_verify" }, encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});
