import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consumeRequestLimit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { appOrigin: "https://example.test", clerkSecretKey: "test-only-private-key" } }));
vi.mock("@/db/request-limits", () => mocks);

import { consumeRequestLimit } from "@/request-limits/client";
import { POST } from "@/app/api/internal/request-limit/route";

const key = "a".repeat(64);
const endpoint = "https://example.test/api/internal/request-limit";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mocks.consumeRequestLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
  fetchMock.mockImplementation((url: string, init: RequestInit) => POST(new Request(url, init)));
});
afterEach(() => vi.unstubAllGlobals());

it("round-trips a signed admission to the Node route without forwarding client credentials", async () => {
  expect(await consumeRequestLimit("mutation", key)).toEqual({ allowed: true, retryAfterSeconds: 60 });
  expect(mocks.consumeRequestLimit).toHaveBeenCalledWith("mutation", key);
  expect(fetchMock.mock.calls[0][0]).toBe(endpoint);
  const init = fetchMock.mock.calls[0][1];
  expect(init).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(init)).not.toMatch(/test-only-private-key|cookie/);
});

it("preserves a denied decision", async () => {
  mocks.consumeRequestLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
  expect(await consumeRequestLimit("authentication", key)).toEqual({ allowed: false, retryAfterSeconds: 17 });
});

it.each(["missing", "forged", "expired", "future", "scope", "key", "tampered"])("rejects %s credentials before touching PostgreSQL", async (kind) => {
  const timestamp = String(Date.now() + (kind === "expired" ? -60_000 : kind === "future" ? 60_000 : 0));
  const scope = kind === "scope" ? "unlimited" : "mutation";
  const identity = kind === "key" ? "client-ip" : key;
  const signature = createHmac("sha256", "test-only-private-key")
    .update(JSON.stringify(["request-limit-transport-v1", scope, identity, timestamp])).digest("hex");
  const headers: HeadersInit = kind === "missing" ? {} : {
    "x-limit-scope": scope, "x-limit-key": kind === "tampered" ? "b".repeat(64) : identity,
    "x-limit-timestamp": timestamp, "x-limit-signature": kind === "forged" ? "0".repeat(64) : signature,
  };
  const response = await POST(new Request(endpoint, { method: "POST", headers }));
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.consumeRequestLimit).not.toHaveBeenCalled();
});

it("fails closed and redacts a database failure", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.consumeRequestLimit.mockRejectedValue(new Error("postgresql://private-password@example.test/private"));
  await expect(consumeRequestLimit("mutation", key)).rejects.toThrow("Request limit unavailable.");
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-password|postgresql/);
  log.mockRestore();
});

it.each([{}, { allowed: "yes", retryAfterSeconds: 60 }, { allowed: true, retryAfterSeconds: 0 }, { allowed: true, retryAfterSeconds: 61 }])("rejects a malformed decision %j", async (decision) => {
  fetchMock.mockResolvedValue(Response.json(decision));
  await expect(consumeRequestLimit("mutation", key)).rejects.toThrow();
});

it("propagates transport failures for the middleware's fail-closed response", async () => {
  fetchMock.mockRejectedValue(new Error("network unavailable"));
  await expect(consumeRequestLimit("mutation", key)).rejects.toThrow();
});
