import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("./index", () => ({ db: mocks }));
import { acceptReceipt } from "./receipts";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const item = { purchaseItemId: id, quantity: "1", quantityUnitId: id, bagWeightKg: null };
const command = { purchaseId: id, requestId: id, revision: 2, complete: false, approveVariance: false, reason: "", items: [item] };
beforeEach(() => { vi.resetAllMocks(); mocks.requirePermission.mockResolvedValue({ organizationId: id }); });

describe("receipt input boundary", () => {
  it.each([null, {}, { ...command, purchaseId: "bad" }, { ...command, requestId: "bad" },
    { ...command, revision: 0 }, { ...command, complete: "true" }, { ...command, approveVariance: "true" },
    { ...command, items: [] }, { ...command, items: Array(101).fill(item) },
    ...["0", "-1", "1e3", "NaN", "0.0000000000000000001"].map((quantity) => ({ ...command, items: [{ ...item, quantity }] })),
    { ...command, items: [item, item] }, { ...command, items: [{ ...item, bagWeightKg: "0" }] },
    { ...command, approveVariance: true, reason: " " },
  ])("rejects malformed commands before database work: %j", async (input) => {
    expect(await acceptReceipt(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("receipts.accept");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("preserves authorization denial", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(acceptReceipt(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
