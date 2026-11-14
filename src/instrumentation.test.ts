import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { onRequestError } from "./instrumentation";

afterEach(() => vi.restoreAllMocks());
describe("server request error hook", () => {
  it("uses Web Crypto for a missing request reference in either runtime", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const uuid = "78bbad77-9a30-41d0-ae5c-cad9354eaa40";
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(uuid);
    await onRequestError(new Error("private"), { path: "/", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/", routeType: "render", revalidateReason: undefined });
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0][0]).correlationId).toBe(uuid);
  });
  it("correlates a render digest with the request without logging headers, paths or payloads", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError(Object.assign(new Error("private SQL"), { digest: "123456789" }), {
      path: "/suppliers/private?phone=private", method: "GET",
      headers: { cookie: "private-cookie", authorization: "private-token", "x-bazardaftar-request-id": "78bbad77-9a30-41d0-ae5c-cad9354eaa40" },
    }, { routerKind: "App Router", routePath: "/suppliers/[id]", routeType: "render", revalidateReason: undefined });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: "server_request_failed", stage: "render", digest: "123456789", correlationId: "78bbad77-9a30-41d0-ae5c-cad9354eaa40" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|suppliers|authorization|cookie|SQL/);
  });
  it("does not log framework control flow", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await onRequestError({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }, { path: "/", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/", routeType: "render", revalidateReason: undefined });
    expect(log).not.toHaveBeenCalled();
  });
});
