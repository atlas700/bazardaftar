import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), createPurchaseDraft: vi.fn(), mutatePurchase: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/purchases", () => mocks);
vi.mock("next/cache", () => mocks);
import { createPurchase, changePurchase } from "./actions";

beforeEach(() => { mocks.requireSession.mockResolvedValue({ userId: "user_a" }); mocks.createPurchaseDraft.mockResolvedValue({ status: "invalid", fields: ["items"] }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ requestId: "request", supplierId: "supplier", warehouseId: "warehouse", currency: "AFN",
    productId: "product", quantity: "2", quantityUnitId: "bag", quantityBagWeightKg: "44", unitPrice: "100", priceUnitId: "maan", priceBagWeightKg: "",
    organizationId: "attacker", role: "owner", total: "0.01", status: "received" })) data.set(key, value);
  return data;
}
describe("purchase create Server Action", () => {
  it("forwards lifecycle revision, replay identity and aligned saved lines without trusting authority", async () => {
    const data = form(); data.set("action", "edit"); data.set("id", "purchase"); data.set("revision", "2"); data.set("savedItemId", "line");
    mocks.mutatePurchase.mockResolvedValue({ status: "invalid", fields: ["items"] });
    await changePurchase({ status: "idle" }, data);
    expect(mocks.mutatePurchase).toHaveBeenCalledWith({ action: "edit", id: "purchase", requestId: "request", revision: 2,
      supplierId: "supplier", warehouseId: "warehouse", currency: "AFN", items: [{ savedItemId: "line", productId: "product", quantity: "2", quantityUnitId: "bag", quantityBagWeightKg: "44", unitPrice: "100", priceUnitId: "maan", priceBagWeightKg: null }] });
    expect(mocks.requireSession).toHaveBeenCalled();
  });
  it.each(["order", "cancel"])("refreshes detail, editor and register after confirmed %s", async (action) => {
    const data = form(); data.set("action", action); data.set("id", "purchase"); data.set("revision", "1"); data.set("reason", "Supplier unavailable");
    mocks.mutatePurchase.mockResolvedValue({ status: "success", purchaseId: "purchase" });
    await expect(changePurchase({ status: "idle" }, data)).rejects.toHaveProperty("digest", expect.stringContaining("/purchases/purchase"));
    expect(mocks.mutatePurchase).toHaveBeenCalledWith({ action, id: "purchase", requestId: "request", revision: 1, reason: "Supplier unavailable" });
    for (const path of ["/purchases", "/purchases/purchase", "/purchases/purchase/edit"]) expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
  });
  it("rejects misaligned saved line identities and preserves safe lifecycle failures", async () => {
    const data = form(); data.set("action", "edit");
    mocks.mutatePurchase.mockResolvedValue({ status: "invalid", fields: ["items"] });
    await changePurchase({ status: "idle" }, data);
    expect(mocks.mutatePurchase).toHaveBeenCalledWith(null);
    mocks.mutatePurchase.mockRejectedValue(new Error("private SQL password"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    data.set("action", "cancel");
    expect(await changePurchase({ status: "idle" }, data)).toMatchObject({ status: "error" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|password|Supplier unavailable/);
  });
  it("authenticates and forwards only supported scalar fields and aligned items", async () => {
    await createPurchase({ status: "idle" }, form());
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.createPurchaseDraft).toHaveBeenCalledWith({ requestId: "request", supplierId: "supplier", warehouseId: "warehouse", currency: "AFN",
      items: [{ productId: "product", quantity: "2", quantityUnitId: "bag", quantityBagWeightKg: "44", unitPrice: "100", priceUnitId: "maan", priceBagWeightKg: null }] });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("refreshes then redirects only on confirmed success", async () => {
    mocks.createPurchaseDraft.mockResolvedValue({ status: "success", purchaseId: "saved" });
    await expect(createPurchase({ status: "idle" }, form())).rejects.toHaveProperty("digest", expect.stringContaining("/purchases/saved"));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/purchases");
  });
  it("rejects mismatched item arrays and malformed transport without silently dropping fields", async () => {
    const data = form(); data.append("quantity", "3");
    await createPurchase({ status: "idle" }, data);
    expect(mocks.createPurchaseDraft).toHaveBeenCalledWith(null);
    // @ts-expect-error Exercise untrusted action transport.
    await createPurchase({ status: "idle" }, null);
    expect(mocks.createPurchaseDraft).toHaveBeenLastCalledWith(null);
  });
  it("preserves redirects and emits only safe diagnostic metadata", async () => {
    mocks.requireSession.mockImplementation(() => redirect("/sign-in"));
    await expect(createPurchase({ status: "idle" }, form())).rejects.toHaveProperty("digest", expect.stringContaining("/sign-in"));
    mocks.requireSession.mockResolvedValue({ userId: "user_a" });
    mocks.createPurchaseDraft.mockRejectedValue(new Error("private SQL password"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createPurchase({ status: "idle" }, form())).toMatchObject({ status: "error", correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|password|supplierId/);
  });
});
