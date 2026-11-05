import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("./index", () => ({ db: mocks }));
import { getPaymentsWorkspace, recordSupplierPayment, reduceSupplierPayable } from "./supplier-payments";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const payment = { requestId: id, supplierId: id, debtCurrency: "AFN", paidOn: "2026-11-05", afnCash: "62", pkrCash: "0", pkrPerAfn: "", reference: "Cash 14", note: "" };
const reduction = { requestId: id, paymentId: id, payableId: id, amount: "0.79", reason: "Supplier agreed to round cash", approved: true };
beforeEach(() => { vi.resetAllMocks(); mocks.requirePermission.mockResolvedValue({ organizationId: id }); });

describe("supplier payment input boundary", () => {
  it.each([null, {}, { ...payment, requestId: "bad" }, { ...payment, supplierId: "bad" },
    { ...payment, debtCurrency: "USD" }, { ...payment, paidOn: "2026-02-30" }, { ...payment, paidOn: "2026-1-1" },
    { ...payment, reference: "x".repeat(101) }, { ...payment, note: "x".repeat(501) },
    ...["-1", "1.0", "1e3", "NaN", "1000000000000000000"].map((afnCash) => ({ ...payment, afnCash })),
    { ...payment, afnCash: "0" }, { ...payment, pkrCash: "1" },
    ...["0", "-1", "2.1234567", "NaN"].map((pkrPerAfn) => ({ ...payment, pkrCash: "1", pkrPerAfn })),
    { ...payment, afnCash: "0", pkrCash: "1", pkrPerAfn: "1000000" },
    { ...payment, debtCurrency: "PKR", afnCash: "999999999999999999", pkrPerAfn: "2" },
  ])("rejects malformed cash without opening a transaction: %j", async (input) => {
    expect(await recordSupplierPayment(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("supplier_payments.record");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...reduction, paymentId: "bad" }, { ...reduction, payableId: "bad" },
    { ...reduction, approved: false }, { ...reduction, approved: "true" }, { ...reduction, reason: " " },
    { ...reduction, reason: "x".repeat(501) }, ...["0", "1", "0.001", "-0.01"].map((amount) => ({ ...reduction, amount })),
  ])("rejects malformed reductions before database work: %j", async (input) => {
    expect(await reduceSupplierPayable(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("supplier_payments.adjust_rounding");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("authorizes before validating either public command", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const command of [recordSupplierPayment, reduceSupplierPayable]) {
      await expect(command(null)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{ supplierId: "bad" }, { currency: "USD" }, { after: "bad" }, { supplierId: [id] }])("denies malformed payment-history scope: %j", async (query) => {
    await expect(getPaymentsWorkspace(query)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("sanitizes unexpected read failures", async () => {
    mocks.transaction.mockRejectedValue(new Error("private SQL details"));
    await expect(getPaymentsWorkspace()).rejects.toThrow("Supplier payments unavailable.");
  });
});
