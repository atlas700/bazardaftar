import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPaymentsWorkspace: vi.fn(), recordSupplierCash: vi.fn(), approveSupplierRounding: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/supplier-payments", () => mocks);
vi.mock("@/db/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("./actions", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: React.ReactNode }) => children, Var: ({ children }: { children: React.ReactNode }) => children, useGT: () => (text: string) => text, useLocaleDirection: () => "rtl" }));
import PaymentsPage from "./page";
import NewPaymentPage from "./new/page";
import RoundingPage from "./rounding/page";
import { PaymentFilter } from "./_components/payment-filter";

const payableId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const paymentId = "dd090eb5-5332-4351-9bc7-f662f232139c";
const workspace = { organizationId: "org", suppliers: [{ id: "supplier", name: "Helmand <grain>", isActive: false }], supplier: { id: "supplier", name: "Helmand <grain>", isActive: false }, currency: "AFN", outstanding: "0.79", canRecord: true, canReduce: true, after: null, nextCursor: null,
  payables: [{ id: payableId, receiptId: "receipt", purchaseId: "purchase", amount: "62.79", outstanding: "0.79", reductions: "0", paymentId }],
  payments: [{ id: paymentId, supplierId: "supplier", supplierName: "Helmand <grain>", currency: "AFN", paidOn: "2026-11-05", afnCash: "62", pkrCash: "0", pkrPerAfn: null, amount: "62.00", reference: "Cash 14", note: "<script>bad</script>", recordedByUserId: "user", recordedByMembershipId: "member", createdAt: new Date("2026-11-05T00:00:00Z") }],
  allocations: [{ paymentId, payableId, amount: "62.00", receiptId: "receipt", purchaseId: "purchase" }], reductions: [],
};
beforeEach(() => { vi.resetAllMocks(); mocks.getPaymentsWorkspace.mockResolvedValue(workspace); });

describe("supplier payment screens", () => {
  it("renders the selected supplier and currency before client hydration", () => {
    const html = renderToStaticMarkup(<PaymentFilter suppliers={workspace.suppliers} supplierId="supplier" currency="AFN" />);
    expect(html.match(/<button[^>]*id="payment-supplier"[^>]*>([\s\S]*?)<\/button>/)?.[1]).toContain("Helmand &lt;grain&gt;");
    expect(html.match(/<button[^>]*id="payment-currency"[^>]*>([\s\S]*?)<\/button>/)?.[1]).toContain("AFN");
  });
  it("shows cash once with receipt allocations, outstanding debt and separate reduction entry", async () => {
    const html = renderToStaticMarkup(await PaymentsPage());
    for (const text of ["Supplier payments", "Helmand &lt;grain&gt;", "0.79", "62.00", "Cash 14", "Record supplier payment", "/payments/rounding?", "/purchases/purchase#receipt-receipt"]) expect(html).toContain(text);
    expect(html).not.toContain("<script>bad</script>"); expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
  });
  it("provides selection and empty states without invented financial data", async () => {
    mocks.getPaymentsWorkspace.mockResolvedValue({ ...workspace, supplier: null, payables: [], payments: [], allocations: [], outstanding: "0.00" });
    const html = renderToStaticMarkup(await PaymentsPage());
    expect(html).toContain("Select a supplier and debt currency"); expect(html).toContain("No supplier payments");
  });
  it("keeps payment entry and rounding controls out of read-only views", async () => {
    mocks.getPaymentsWorkspace.mockResolvedValue({ ...workspace, canRecord: false, canReduce: false });
    const html = renderToStaticMarkup(await PaymentsPage());
    expect(html).not.toContain("Record supplier payment"); expect(html).not.toContain("/payments/rounding?");
    await expect(NewPaymentPage()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(RoundingPage({ searchParams: Promise.resolve({ payableId }) })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("labels whole cash and exchange fields without asking staff to choose a receipt", async () => {
    const html = renderToStaticMarkup(await NewPaymentPage());
    for (const name of ["requestId", "supplierId", "debtCurrency", "paidOn", "afnCash", "pkrCash", "pkrPerAfn", "reference", "note"]) expect(html).toContain(`name="${name}"`);
    expect(html).not.toContain('name="payableId"'); expect(html).not.toContain('name="organizationId"');
    expect(html).toContain("1 AFN ="); expect(html).toContain("oldest unpaid receipts");
  });
  it("shows explicit owner approval and the payable's remaining lifetime allowance", async () => {
    const html = renderToStaticMarkup(await RoundingPage({ searchParams: Promise.resolve({ payableId }) }));
    for (const name of ["requestId", "paymentId", "payableId", "amount", "reason", "approved"]) expect(html).toContain(`name="${name}"`);
    expect(html).toContain("0.99"); expect(html).toContain("not a cash payment"); expect(html).toContain("As owner, I approve");
  });
});
