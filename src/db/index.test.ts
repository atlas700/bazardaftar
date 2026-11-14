import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { configuration } = vi.hoisted(() => ({
  configuration: {
    databaseUrl: "postgresql://test:placeholder@127.0.0.1:1/afcs_test",
    nodeEnvironment: "development",
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: configuration }));

const databaseGlobal: typeof globalThis & { afcsDatabasePool?: Pool } = globalThis;
const pools = new Set<Pool>();

async function loadDatabase() {
  const { db } = await import("./index");
  pools.add(db.$client);
  return db;
}

beforeEach(() => {
  vi.resetModules();
  configuration.nodeEnvironment = "development";
});

afterEach(async () => {
  delete databaseGlobal.afcsDatabasePool;
  await Promise.all([...pools].map((pool) => pool.end()));
  pools.clear();
  vi.restoreAllMocks();
});

describe("database client", () => {
  it("does not open connections or execute queries during import", async () => {
    const connect = vi.spyOn(Pool.prototype, "connect");
    const query = vi.spyOn(Pool.prototype, "query");
    const db = await loadDatabase();
    expect(connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(db.$client.totalCount).toBe(0);
    expect(db.$client.options.connectionTimeoutMillis).toBe(5000);
  });

  it("reuses the pool across development module reloads without duplicate handlers", async () => {
    const first = await loadDatabase();
    vi.resetModules();
    const second = await loadDatabase();
    expect(second.$client).toBe(first.$client);
    expect(second.$client.listenerCount("error")).toBe(1);
  });

  it("does not cache production pools on the development global", async () => {
    configuration.nodeEnvironment = "production";
    const first = await loadDatabase();
    vi.resetModules();
    const second = await loadDatabase();
    expect(second.$client).not.toBe(first.$client);
    expect(databaseGlobal.afcsDatabasePool).toBeUndefined();
  });

  it("handles background pool errors without logging the error or credentials", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = await loadDatabase();
    expect(() => db.$client.emit("error", new Error(configuration.databaseUrl))).not.toThrow();
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: "database_pool_failed", stage: "pool", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain(configuration.databaseUrl);
  });
});
