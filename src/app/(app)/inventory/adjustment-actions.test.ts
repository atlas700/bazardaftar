import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), adjustInventory: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/inventory-adjustments", () => mocks);
vi.mock("next/cache", () => mocks);
import { recordAdjustment } from "./adjustment-actions";

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ requestId: "request", productId: "product", warehouseId: "warehouse", quantityKg: "-1.001", reasonCode: "loss", reason: "Counted loss", reference: "Count 14", approved: "on" })) data.set(key, value);
  return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.adjustInventory.mockResolvedValue({ status: "invalid", fields: ["reason"] }); });
describe("inventory adjustment action", () => {
  it("authenticates and forwards only correction fields with explicit approval", async () => {
    const data = form(); data.set("organizationId", "spoof"); data.set("role", "owner");
    await recordAdjustment({ status: "idle" }, data);
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.adjustInventory).toHaveBeenCalledWith({ requestId: "request", productId: "product", warehouseId: "warehouse", quantityKg: "-1.001", reasonCode: "loss", reason: "Counted loss", reference: "Count 14", approved: true });
  });
  it("rejects duplicate scalar values", async () => {
    const data = form(); data.append("productId", "other");
    await recordAdjustment({ status: "idle" }, data);
    expect(mocks.adjustInventory).toHaveBeenCalledWith(null);
  });
  it("refreshes inventory and redirects to its product history after success", async () => {
    mocks.adjustInventory.mockResolvedValue({ status: "success", productId: "product", movementId: "movement" });
    await expect(recordAdjustment({ status: "idle" }, form())).rejects.toHaveProperty("digest", expect.stringContaining("/inventory?productId=product#movement-movement"));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/inventory");
  });
  it("preserves denial and returns safe recovery after an uncertain write", async () => {
    mocks.requireSession.mockRejectedValueOnce({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(recordAdjustment({ status: "idle" }, form())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.adjustInventory.mockRejectedValue(new Error("private SQL password"));
    expect(await recordAdjustment({ status: "idle" }, form())).toMatchObject({ status: "error", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("password"); log.mockRestore();
  });
});
vi.mock("server-only", () => ({}));
