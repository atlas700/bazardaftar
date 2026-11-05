import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), acceptReceipt: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/receipts", () => mocks);
vi.mock("next/cache", () => mocks);
import { receivePurchase } from "./receipt-actions";

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ purchaseId: "purchase", requestId: "request", revision: "2", purchaseItemId: "line", quantity: "1", quantityUnitId: "kg", bagWeightKg: "", reason: "" })) data.set(key, value);
  return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.acceptReceipt.mockResolvedValue({ status: "invalid", fields: ["items"] }); });
describe("receipt action", () => {
  it("authenticates and sends aligned fields with explicit completion and approval", async () => {
    const data = form(); data.set("complete", "on"); data.set("approveVariance", "on"); data.set("reason", "Short delivery");
    await receivePurchase({ status: "idle" }, data);
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.acceptReceipt).toHaveBeenCalledWith({ purchaseId: "purchase", requestId: "request", revision: 2, complete: true, approveVariance: true, reason: "Short delivery",
      items: [{ purchaseItemId: "line", quantity: "1", quantityUnitId: "kg", bagWeightKg: null }] });
  });
  it("omits blank lines while rejecting truncated columns and duplicate scalar fields", async () => {
    const data = form(); data.append("purchaseItemId", "line2"); data.append("quantity", ""); data.append("quantityUnitId", "kg"); data.append("bagWeightKg", "");
    await receivePurchase({ status: "idle" }, data);
    expect(mocks.acceptReceipt.mock.calls[0][0].items).toHaveLength(1);
    data.append("quantity", "1"); await receivePurchase({ status: "idle" }, data);
    expect(mocks.acceptReceipt).toHaveBeenLastCalledWith(null);
    const duplicate = form(); duplicate.append("purchaseId", "other"); await receivePurchase({ status: "idle" }, duplicate);
    expect(mocks.acceptReceipt).toHaveBeenLastCalledWith(null);
  });
  it("refreshes the purchase and redirects to the accepted receipt", async () => {
    mocks.acceptReceipt.mockResolvedValue({ status: "success", purchaseId: "purchase", receiptId: "receipt" });
    await expect(receivePurchase({ status: "idle" }, form())).rejects.toHaveProperty("digest", expect.stringContaining("/purchases/purchase#receipt-receipt"));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/purchases/purchase");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/purchases");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory");
  });
  it("preserves framework denial and sanitizes unexpected errors", async () => {
    mocks.requireSession.mockRejectedValueOnce({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(receivePurchase({ status: "idle" }, form())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.acceptReceipt.mockRejectedValue(new Error("private SQL secret"));
    const result = await receivePurchase({ status: "idle" }, form());
    expect(result).toMatchObject({ status: "error", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret"); log.mockRestore();
  });
});
