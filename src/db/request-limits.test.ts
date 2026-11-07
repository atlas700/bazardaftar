import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client();
  client.query = mocks.query;
  return { db: drizzle({ client }) };
});

import { consumeRequestLimit } from "./request-limits";

const key = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockImplementation(async (query) => ({ rows: query.text.includes("returning hits") ? [{ allowed: true, retry_after_seconds: 60 }] : [] }));
});

describe("shared request limiter", () => {
  it("uses a parameterized atomic upsert, database time and bounded cleanup in its own transaction", async () => {
    expect(await consumeRequestLimit("mutation", key)).toEqual({ allowed: true, retryAfterSeconds: 60 });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.includes("returning hits"))!;
    expect(values).toEqual(expect.arrayContaining([key, "mutation", 60]));
    expect(query.text).not.toContain(key);
    expect(query.text).toContain("on conflict");
    expect(query.text).toContain("statement_timestamp()");
    expect(query.text).toContain("skip locked");
    expect(query.text).toContain("limit 100");
    expect(mocks.query.mock.calls[0][0].text).toBe("begin");
    expect(mocks.query.mock.calls.at(-1)![0].text).toBe("commit");
  });

  it("returns denial and a positive retry time without swallowing storage failures", async () => {
    mocks.query.mockImplementation(async (query) => ({ rows: query.text.includes("returning hits") ? [{ allowed: false, retry_after_seconds: 12 }] : [] }));
    expect(await consumeRequestLimit("authentication", key)).toEqual({ allowed: false, retryAfterSeconds: 12 });
    mocks.query.mockRejectedValueOnce(new Error("private database failure"));
    await expect(consumeRequestLimit("mutation", key)).rejects.toThrow();
  });

  it("rejects malformed identity keys before querying", async () => {
    await expect(consumeRequestLimit("anonymous", "client-supplied-ip")).rejects.toThrow();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
