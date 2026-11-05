import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("./index", () => ({ db: mocks }));
import { adjustInventory } from "./inventory-adjustments";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const command = { requestId: id, productId: id, warehouseId: id, quantityKg: "-1.001", reasonCode: "loss", reason: "Damaged during handling", reference: "Count 14", approved: true };
beforeEach(() => { vi.resetAllMocks(); mocks.requirePermission.mockResolvedValue({ organizationId: id }); });

describe("inventory adjustment boundary", () => {
  it.each([null, {}, { ...command, productId: "foreign" }, { ...command, requestId: "bad" },
    { ...command, warehouseId: "bad" }, { ...command, approved: false }, { ...command, approved: "true" },
    { ...command, reason: " " }, { ...command, reason: "x".repeat(501) }, { ...command, reference: "x".repeat(101) },
    { ...command, reasonCode: "sale" }, { ...command, reasonCode: "opening_stock" }, { ...command, quantityKg: "1" },
    ...["0", "-0.000", "0.0001", "1e3", "NaN", "1000000000000000000", "-1000000000000000000"].map((quantityKg) => ({ ...command, quantityKg })),
  ])("rejects invalid corrections before database work: %j", async (input) => {
    expect(await adjustInventory(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("inventory.correct");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("preserves authorization denial before validating or writing", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(adjustInventory(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
