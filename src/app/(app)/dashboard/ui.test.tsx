import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));
vi.mock("@/db/dashboard", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
import DashboardPage from "./page";
import Loading from "./loading";
import ErrorView from "./error";
import type { Dashboard } from "@/db/dashboard";

const data: Dashboard = {
  capabilities: { purchases: true, inventory: true, balances: true, payments: true, createPurchase: true, recordPayment: true },
  purchases: { total: "4", draft: "1", awaiting: "2", received: "1", cancelled: "0", receipts: "3" },
  stock: [{ productId: "wheat", warehouseId: "main", productName: "Helmand wheat", warehouseName: "Main", productActive: true, warehouseActive: true, quantityKg: "1234.567" }],
  balances: [{ currency: "AFN", outstanding: "1999999999999999999.98" }, { currency: "PKR", outstanding: "12.00" }],
  transactions: [{ id: "receipt-a", kind: "receipt", postedAt: "2026-11-07T01:02:03.000001Z", name: "Grain supplier", amount: "100.00", currency: "AFN", purchaseId: "purchase-a", supplierId: null, productId: null }],
};
beforeEach(() => mocks.getDashboard.mockResolvedValue(data));
describe("pilot dashboard screen", () => {
  it("shows exact separate currencies, recorded stock, purchase counts and source links", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    for (const text of ["1,999,999,999,999,999,999.98", "12.00", "1,234.567", "Accepted receipts", "Awaiting delivery", "Outgoing stock is not yet recorded", "UTC"]) expect(html).toContain(text);
    expect(html).toContain('href="/purchases/purchase-a#receipt-receipt-a"');
    expect(html).toContain('href="/inventory?productId=wheat"');
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("sales");
  });
  it("shows real empty and zero states with safe next actions", async () => {
    mocks.getDashboard.mockResolvedValue({ ...data, purchases: { total: "0", draft: "0", awaiting: "0", received: "0", cancelled: "0", receipts: "0" }, stock: [], transactions: [], balances: data.balances!.map((b) => ({ ...b, outstanding: "0.00" })) });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("No purchases yet"); expect(html).toContain("No recorded stock yet");
    expect(html).toContain("No recent transactions"); expect(html).toContain("0.00");
    expect(html).toContain('href="/purchases/new"');
  });
  it("keeps permission-limited datasets distinct from empty data", async () => {
    mocks.getDashboard.mockResolvedValue({ ...data, capabilities: { ...data.capabilities, purchases: false, balances: false, payments: false, createPurchase: false, recordPayment: false }, purchases: null, balances: null, transactions: [] });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Your role does not include purchase records");
    expect(html).toContain("Your role does not include supplier balances");
    expect(html).not.toContain("AFN"); expect(html).not.toContain("PKR");
    expect(html).not.toContain('href="/payments'); expect(html).not.toContain('href="/purchases');
    expect(html).toContain("Helmand wheat");
  });
  it("escapes long names and labels inactive history", async () => {
    mocks.getDashboard.mockResolvedValue({ ...data, stock: [{ ...data.stock![0], productName: "<script>grain</script>", productActive: false }] });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).not.toContain("<script>grain"); expect(html).toContain("Inactive product");
  });
  it("offers loading feedback and a safe retry without leaking failures", () => {
    expect(renderToStaticMarkup(<Loading />)).toContain('role="status"');
    const html = renderToStaticMarkup(<ErrorView retry={() => {}} />);
    expect(html).toContain("Try again"); expect(html).toContain("Dashboard could not be loaded");
  });
});
