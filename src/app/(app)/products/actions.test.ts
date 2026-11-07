import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), manageCatalog: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/catalog", () => mocks);
vi.mock("next/cache", () => mocks);
import { updateProduct } from "./actions";
import { NO_CATEGORY_VALUE } from "./no-category";

beforeEach(() => { mocks.requireSession.mockResolvedValue({ userId: "user_a" }); mocks.manageCatalog.mockResolvedValue({ status: "success" }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

describe("product Server Action", () => {
  it("authenticates, forwards only product fields, and refreshes list and detail", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ operation: "create-product", name: "Wheat", sku: "W", unitId: "unit", categoryId: "", organizationId: "attacker" })) form.set(key, value);
    expect(await updateProduct({ status: "idle" }, form)).toEqual({ status: "success" });
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.manageCatalog).toHaveBeenCalledWith({ operation: "create-product", id: null, name: "Wheat", sku: "W", unitId: "unit", categoryId: null });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/products"], ["/products/[id]", "page"]]);
  });
  it("normalizes the Radix no-category value before validation", async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ operation: "create-product", name: "Wheat", sku: "W", unitId: "unit", categoryId: NO_CATEGORY_VALUE })) form.set(key, value);
    await updateProduct({ status: "idle" }, form);
    expect(mocks.manageCatalog).toHaveBeenCalledWith(expect.objectContaining({ categoryId: null }));
  });
  it("preserves sign-in redirects and permission denials", async () => {
    mocks.requireSession.mockImplementation(() => redirect("/sign-in"));
    await expect(updateProduct({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
    expect(mocks.manageCatalog).not.toHaveBeenCalled();
    mocks.requireSession.mockResolvedValue({ userId: "user_a" });
    mocks.manageCatalog.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(updateProduct({ status: "idle" }, new FormData())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes unexpected failures and ambiguous refresh failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.revalidatePath.mockImplementation(() => { throw new Error("private SQL password"); });
    const form = new FormData(); form.set("operation", "deactivate-product"); form.set("id", "product");
    expect(await updateProduct({ status: "idle" }, form)).toEqual({ status: "error", correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ stage: "refresh" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|SQL|password|product"/);
  });
  it("rejects unrelated operations and malformed transport without skipping service authorization", async () => {
    mocks.manageCatalog.mockResolvedValue({ status: "invalid", fields: ["operation"] });
    const form = new FormData(); form.set("operation", "deactivate-unit");
    await updateProduct({ status: "idle" }, form);
    expect(mocks.manageCatalog).toHaveBeenCalledWith(null);
    // @ts-expect-error Exercise the untrusted Server Action transport.
    await updateProduct({ status: "idle" }, null);
    expect(mocks.manageCatalog).toHaveBeenLastCalledWith(null);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["invalid", "duplicate", "conflict"])("does not refresh on %s", async (status) => {
    mocks.manageCatalog.mockResolvedValue({ status });
    await updateProduct({ status: "idle" }, new FormData());
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
