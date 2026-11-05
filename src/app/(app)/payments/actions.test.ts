import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), recordSupplierPayment: vi.fn(), reduceSupplierPayable: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/supplier-payments", () => mocks);
vi.mock("next/cache", () => mocks);
import { approveSupplierRounding, recordSupplierCash } from "./actions";

function form(reduction = false) {
  const data = new FormData();
  const fields = reduction ? { requestId: "retry", paymentId: "payment", payableId: "payable", amount: "0.79", reason: "Supplier agreed", approved: "on" }
    : { requestId: "retry", supplierId: "supplier", debtCurrency: "AFN", paidOn: "2026-11-05", afnCash: "62", pkrCash: "0", pkrPerAfn: "", reference: "Cash 14", note: "Counted" };
  Object.entries(fields).forEach(([key, value]) => data.set(key, value)); return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.recordSupplierPayment.mockResolvedValue({ status: "invalid", fields: ["afnCash"] }); mocks.reduceSupplierPayable.mockResolvedValue({ status: "invalid", fields: ["amount"] }); });

describe("supplier settlement actions", () => {
  it("authenticates and extracts only scalar cash fields, rejecting duplicates", async () => {
    const data = form(); data.set("organizationId", "attacker"); data.set("amount", "1");
    await recordSupplierCash({ status: "idle" }, data);
    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.recordSupplierPayment).toHaveBeenLastCalledWith(Object.fromEntries(form()));
    data.append("afnCash", "100"); await recordSupplierCash({ status: "idle" }, data);
    expect(mocks.recordSupplierPayment).toHaveBeenLastCalledWith(null);
  });
  it("requires explicit reduction approval and rejects duplicate control fields", async () => {
    const data = form(true); await approveSupplierRounding({ status: "idle" }, data);
    expect(mocks.reduceSupplierPayable).toHaveBeenLastCalledWith({ ...Object.fromEntries(data), approved: true });
    data.delete("approved"); await approveSupplierRounding({ status: "idle" }, data);
    expect(mocks.reduceSupplierPayable).toHaveBeenLastCalledWith(expect.objectContaining({ approved: false }));
    data.append("reason", "duplicate"); await approveSupplierRounding({ status: "idle" }, data);
    expect(mocks.reduceSupplierPayable).toHaveBeenLastCalledWith(null);
  });
  it("accepts omitted optional cash-entry fields as empty strings", async () => {
    const data = form(); for (const name of ["pkrPerAfn", "reference", "note"]) data.delete(name);
    await recordSupplierCash({ status: "idle" }, data);
    expect(mocks.recordSupplierPayment).toHaveBeenLastCalledWith({ ...Object.fromEntries(data), pkrPerAfn: "", reference: "", note: "" });
  });
  it.each([false, true])("refreshes financial entry points and redirects after success (reduction: %s)", async (reduction) => {
    const service = reduction ? mocks.reduceSupplierPayable : mocks.recordSupplierPayment;
    service.mockResolvedValue({ status: "success", supplierId: "supplier", currency: "AFN", paymentId: "payment" });
    await expect((reduction ? approveSupplierRounding : recordSupplierCash)({ status: "idle" }, form(reduction))).rejects.toHaveProperty("digest", expect.stringContaining("/payments?supplierId=supplier&currency=AFN#payment-payment"));
    for (const path of ["/payments", "/suppliers", "/suppliers/supplier"]) expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
  });
  it("preserves framework denial and gives safe retry references for unconfirmed writes", async () => {
    mocks.requireSession.mockRejectedValueOnce({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(recordSupplierCash({ status: "idle" }, form())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recordSupplierPayment.mockRejectedValue(new Error("private SQL secret"));
    expect(await recordSupplierCash({ status: "idle" }, form())).toMatchObject({ status: "error", correlationId: expect.any(String) });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret"); log.mockRestore();
  });
});
