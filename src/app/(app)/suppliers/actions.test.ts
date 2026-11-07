import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), manageSupplier: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/suppliers", () => mocks);
vi.mock("next/cache", () => mocks);
import { updateSupplier } from "./actions";

beforeEach(() => { mocks.requireSession.mockResolvedValue({ userId: "user_a" }); mocks.manageSupplier.mockResolvedValue({ status: "success" }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

describe("supplier Server Action", () => {
  it("authenticates, forwards only contact fields and refreshes list/detail", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ operation: "create-supplier", name: "Helmand Grain", phone: "0700123456",
      location: "Lashkar Gah", type: "business", notes: "Call first", paymentTerms: "By agreement", organizationId: "attacker", balance: "500" })) form.set(key, value);
    expect(await updateSupplier({ status: "idle" }, form)).toEqual({ status: "success" });
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.manageSupplier).toHaveBeenCalledWith({ operation: "create-supplier", id: null, name: "Helmand Grain", phone: "0700123456",
      location: "Lashkar Gah", type: "business", notes: "Call first", paymentTerms: "By agreement" });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/suppliers"], ["/suppliers/[id]", "page"]]);
  });
  it.each(["unspecified", ""])("normalizes the optional type %s", async (type) => {
    const form = new FormData(); form.set("operation", "create-supplier"); form.set("type", type);
    await updateSupplier({ status: "idle" }, form);
    expect(mocks.manageSupplier).toHaveBeenCalledWith(expect.objectContaining({ type: null }));
  });
  it("maps the supplier-specific form identifier to the validated command id", async () => {
    const form = new FormData(); form.set("operation", "deactivate-supplier"); form.set("supplierId", "supplier"); form.set("id", "spoofed");
    await updateSupplier({ status: "idle" }, form);
    expect(mocks.manageSupplier).toHaveBeenCalledWith(expect.objectContaining({ operation: "deactivate-supplier", id: "supplier" }));
  });
  it("preserves sign-in redirects and permission denials", async () => {
    mocks.requireSession.mockImplementation(() => redirect("/sign-in"));
    await expect(updateSupplier({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
    expect(mocks.manageSupplier).not.toHaveBeenCalled();
    mocks.requireSession.mockResolvedValue({ userId: "user_a" });
    mocks.manageSupplier.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(updateSupplier({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes failures, including an ambiguous refresh after saving", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revalidatePath.mockImplementation(() => { throw new Error("private SQL password"); });
    const form = new FormData(); form.set("operation", "deactivate-supplier");
    expect(await updateSupplier({ status: "idle" }, form)).toEqual({ status: "error", correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ stage: "refresh" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|SQL|password/);
  });
  it("rejects foreign operations and malformed transport through the authorized service", async () => {
    mocks.manageSupplier.mockResolvedValue({ status: "invalid", fields: ["operation"] });
    const form = new FormData(); form.set("operation", "create-product");
    await updateSupplier({ status: "idle" }, form);
    expect(mocks.manageSupplier).toHaveBeenCalledWith(null);
    // @ts-expect-error Exercise the untrusted Server Action transport.
    await updateSupplier({ status: "idle" }, null);
    expect(mocks.manageSupplier).toHaveBeenLastCalledWith(null);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["invalid", "duplicate", "conflict"])("does not refresh on %s", async (status) => {
    mocks.manageSupplier.mockResolvedValue({ status });
    await updateSupplier({ status: "idle" }, new FormData());
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
