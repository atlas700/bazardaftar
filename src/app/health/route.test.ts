import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/db", () => ({ db: { $client: { query } } }));

beforeEach(() => { query.mockReset(); });

it("checks the database with a bounded, read-only query and prevents caching", async () => {
  query.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  const response = await GET();
  expect(query).toHaveBeenCalledWith({ text: "select 1", query_timeout: 5000 });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

it("returns an uncached 503 without exposing connection errors", async () => {
  query.mockRejectedValue(new Error("postgresql://private:secret@database/tenant"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "unavailable" });
});
