import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), transaction: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("./index", () => ({ db: mocks }));
import { createPurchaseDraft, getPurchase, getPurchasesWorkspace } from "./purchases";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const item = { productId: id, quantity: "2", quantityUnitId: id, quantityBagWeightKg: null,
  unitPrice: "100", priceUnitId: id, priceBagWeightKg: null };
const command = { requestId: id, supplierId: id, warehouseId: id, currency: "AFN", items: [item] };
beforeEach(() => mocks.requirePermission.mockResolvedValue({ organizationId: id, userId: "user_a", membershipId: "member_a" }));
afterEach(() => vi.resetAllMocks());

describe("purchase draft service boundaries", () => {
  it.each([
    null, { ...command, requestId: "bad" }, { ...command, supplierId: "bad" }, { ...command, warehouseId: "bad" },
    { ...command, currency: "USD" }, { ...command, items: [] }, { ...command, items: Array(101).fill(item) },
    ...["0", "-1", "1e3", "0.0000000000000000001", "1".repeat(19)].map((quantity) => ({ ...command, items: [{ ...item, quantity }] })),
    ...["-0.01", "1.001", "NaN", "1".repeat(19)].map((unitPrice) => ({ ...command, items: [{ ...item, unitPrice }] })),
    { ...command, items: [{ ...item, productId: "bad" }] },
    { ...command, items: [{ ...item, quantityBagWeightKg: "0" }] },
  ])("rejects invalid draft input before database work: %j", async (input) => {
    expect(await createPurchaseDraft(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("purchases.manage");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("preserves authorization control flow for all operations", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const work of [getPurchasesWorkspace, () => getPurchase(id), () => createPurchaseDraft(command)]) {
      await expect(work()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects malformed detail IDs and sanitizes unexpected read failures", async () => {
    await expect(getPurchase("bad")).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    mocks.select.mockImplementation(() => { throw new Error("private SQL password"); });
    await expect(getPurchasesWorkspace()).rejects.toThrow(/^Purchases unavailable\.$/);
    await expect(getPurchase(id)).rejects.toThrow(/^Purchases unavailable\.$/);
  });
});
