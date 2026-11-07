import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupplierAccount: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/supplier-statements", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: React.ReactNode }) => children, Var: ({ children }: { children: React.ReactNode }) => children }));
import StatementPage from "./page";
import StatementError from "./error";
import StatementLoading from "./loading";
import StatementNotFound from "./not-found";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const data = {
  supplier: { id, name: "Helmand <grain>", isActive: false, paymentTerms: "By agreement <script>" }, currency: "AFN", canRecord: true, after: null, nextCursor: "receipt:older",
  balances: [{ currency: "AFN", debt: "100.79", allocated: "75.00", reductions: "0.79", outstanding: "25.00" }, { currency: "PKR", debt: "12.00", allocated: "0.00", reductions: "0.00", outstanding: "12.00" }],
  entries: [
    { id: "reduction", kind: "reduction", postedAt: "2026-11-07T12:00:00.000003Z", amount: "0.79", runningBalance: "25.00", receiptId: "receipt", purchaseId: "purchase", paymentId: "payment", reason: "Agreed <script>", approvedByUserId: "owner" },
    { id: "payment", kind: "payment", postedAt: "2026-11-07T12:00:00.000002Z", amount: "75.00", runningBalance: "25.79", paymentId: "payment", paidOn: "2026-11-05", afnCash: "74", pkrCash: "2", pkrPerAfn: "2.000000", reference: "Cash 14", note: "Counted <script>" },
    { id: "payable", kind: "receipt", postedAt: "2026-11-07T12:00:00.000001Z", amount: "100.79", runningBalance: "100.79", receiptId: "receipt", purchaseId: "purchase" },
  ],
  allocations: [{ paymentId: "payment", payableId: "payable", receiptId: "receipt", purchaseId: "purchase", amount: "60.00" }, { paymentId: "payment", payableId: "second", receiptId: "second", purchaseId: "purchase", amount: "15.00" }],
};
const props = { params: Promise.resolve({ id }), searchParams: Promise.resolve({ currency: "AFN" }) };
beforeEach(() => { vi.resetAllMocks(); mocks.getSupplierAccount.mockResolvedValue(data); });

describe("supplier statement screen", () => {
  it("shows separate currency totals, signed events and the full-account running balance", async () => {
    const html = renderToStaticMarkup(await StatementPage(props));
    for (const text of ["Supplier statement", "Helmand &lt;grain&gt;", "25.00", "12.00", "100.79", "Owner-approved reduction", "Cash payment", "Receipt debt", "Balance after posting", "Posting order"]) expect(html).toContain(text);
    expect(html).toContain('aria-current="page"'); expect(html).toContain("currency=PKR");
    expect(html).not.toContain("Due date"); expect(html).not.toContain("<script>");
  });
  it("shows original cash once and links even an older payment and every receipt allocation", async () => {
    const html = renderToStaticMarkup(await StatementPage(props));
    expect((html.match(/74 AFN/g) ?? [])).toHaveLength(1);
    for (const text of ["2.000000", "Cash 14", "60.00", "15.00", "paymentId=payment", "/purchases/purchase#receipt-receipt", "Agreed &lt;script&gt;", "Approved by:"]) expect(html).toContain(text);
    expect(html).toContain("not cash"); expect(html).toContain("Inactive supplier");
  });
  it("preserves currency in pagination, resets it for currency changes, and exposes no mutations", async () => {
    mocks.getSupplierAccount.mockResolvedValue({ ...data, after: "payment:current", canRecord: false });
    const html = renderToStaticMarkup(await StatementPage(props));
    expect(html).toContain("Older entries"); expect(html).toContain("Latest entries"); expect(html).toContain("after=receipt%3Aolder");
    expect(html).not.toContain("Record supplier payment"); expect(html).not.toContain("<form");
    expect(mocks.getSupplierAccount).toHaveBeenCalledWith({ supplierId: id, currency: "AFN", after: undefined });
  });
  it("provides a useful empty currency state and loading/error/unavailable recovery", async () => {
    mocks.getSupplierAccount.mockResolvedValue({ ...data, entries: [], allocations: [], nextCursor: null });
    const html = renderToStaticMarkup(await StatementPage(props));
    expect(html).toContain("No account postings in this currency"); expect(html).not.toContain("Older entries");
    const retry = vi.fn(); expect(StatementError({ retry }).props.retry).toBe(retry);
    expect(renderToStaticMarkup(<StatementLoading />)).toContain('role="status"');
    expect(renderToStaticMarkup(<StatementNotFound />)).toContain("Back to suppliers");
  });
});
