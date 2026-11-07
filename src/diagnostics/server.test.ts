import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mocks);
import { actionFailure, logFailure, safeServerError } from "./server";

const requestId = "78bbad77-9a30-41d0-ae5c-cad9354eaa40";
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

describe("safe server diagnostics", () => {
  it("returns the same reference as its JSON log without exposing error contents", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.headers.mockResolvedValue(new Headers({ "x-bazardaftar-request-id": requestId, cookie: "private-cookie" }));
    const error = Object.assign(new Error("private SQL password supplier phone"), { code: "23505", detail: "private-row" });
    expect(await actionFailure("receipt_acceptance_failed", "receipt-posting", error)).toEqual({ status: "error", correlationId: requestId });
    const event = JSON.parse(log.mock.calls[0][0]);
    expect(event).toEqual({ timestamp: expect.any(String), level: "error", event: "receipt_acceptance_failed", stage: "receipt-posting", correlationId: requestId, failureKind: "database" });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|SQL|password|supplier phone|23505/);
  });

  it("falls back to a fresh UUID for absent or malformed request context", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.headers.mockResolvedValue(new Headers({ "x-bazardaftar-request-id": "private-injected" }));
    const first = await actionFailure("purchase_draft_failed", "authentication", null);
    mocks.headers.mockRejectedValue(new Error("outside request"));
    const second = await actionFailure("purchase_draft_failed", "authentication", null);
    expect(first.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.correlationId).not.toBe(first.correlationId);
  });

  it("preserves framework redirects and denials without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let control: unknown;
    try { redirect("/sign-in"); } catch (error) { control = error; }
    await expect(actionFailure("purchase_draft_failed", "authentication", control)).rejects.toBe(control);
    const denied = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
    await expect(actionFailure("purchase_draft_failed", "authentication", denied)).rejects.toBe(denied);
    expect(log).not.toHaveBeenCalled();
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it("retains only a safe failure category through nested sanitizing boundaries", () => {
    const raw = Object.assign(new Error("private connection string"), { code: "ECONNREFUSED" });
    const error = safeServerError("Business access unavailable.", safeServerError("Context unavailable.", raw));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logFailure("server_request_failed", "render", error);
    expect(JSON.parse(log.mock.calls[0][0]).failureKind).toBe("connectivity");
    expect(JSON.stringify(error)).not.toMatch(/private|ECONNREFUSED/);
    expect(error.cause).toBeUndefined();
  });

  it("bounds cause traversal and emits background failures without request APIs", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error: { cause?: unknown } = {}; error.cause = error;
    const reference = logFailure("database_pool_failed", "pool", error);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ correlationId: reference, failureKind: "unknown" });
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "57014" }, "timeout"], [{ code: "ETIMEDOUT" }, "timeout"],
    [{ cause: { code: "40001" } }, "database"], [{ clerkError: true }, "provider"],
    [{ code: "private-code", status: 500, data: "private-payload" }, "unknown"],
  ])("records only an allowlisted failure category", (error, kind) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logFailure("server_request_failed", "action", error, { requestId: "private-id", digest: "private-digest" });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ failureKind: kind });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|payload|digest/);
  });

  it("does not share request references between concurrent actions", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const secondId = "27249b3a-0ec8-4301-b981-f35ab215d48d";
    mocks.headers.mockResolvedValueOnce(new Headers({ "x-bazardaftar-request-id": requestId }))
      .mockResolvedValueOnce(new Headers({ "x-bazardaftar-request-id": secondId }));
    const results = await Promise.all([actionFailure("purchase_draft_failed", "draft-creation", null), actionFailure("purchase_draft_failed", "draft-creation", null)]);
    expect(results.map((result) => result.correlationId)).toEqual([requestId, secondId]);
    expect(log.mock.calls.map(([entry]) => JSON.parse(entry).correlationId)).toEqual([requestId, secondId]);
  });
});
