import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseState } from "@/db/purchases";

const mocks = vi.hoisted(() => ({ getPurchasesWorkspace: vi.fn(), getPurchase: vi.fn(), getState: vi.fn<() => PurchaseState>(), pending: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("@/db/purchases", () => mocks);
vi.mock("./actions", () => ({ createPurchase: vi.fn() }));
vi.mock("gt-next", () => ({ useLocaleDirection: () => "rtl", useGT: () => (text: string) => text, T: ({ children }: { children: ReactNode }) => children, Var: ({ children }: { children: ReactNode }) => children }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useActionState: () => [mocks.getState(), () => {}, mocks.pending] }));
import PurchasesPage from "./page";
import PurchasePage from "./[id]/page";
import { PurchaseForm } from "./_components/purchase-form";
import PurchasesError from "./error";
import { PurchaseNumber } from "./_components/purchase-number";

const workspace = { organizationId: "business", canManage: true, purchases: [], suppliers: [{ id: "supplier", name: "Helmand Grain" }],
  warehouse: { id: "warehouse", name: "Main warehouse" }, products: [{ id: "wheat", name: "Wheat", unitId: "kg" }],
  units: [{ id: "kg", name: "kg", kind: "fixed" as const, kilogramsPerUnit: "1.000" }, { id: "bag", name: "bag", kind: "bag" as const, kilogramsPerUnit: null }] };
const purchase = { id: "purchase", supplierName: "Helmand Grain", warehouseName: "Main warehouse", status: "draft", total: "2000.00", currency: "AFN", createdAt: new Date("2026-11-02T07:00:00Z"), items: [
  { id: "line", lineNumber: 1, productName: "Wheat", productSku: "W-1", quantity: "2.000000000000000000", quantityUnitName: "bag", quantityUnitKind: "bag", quantityMeasureKg: "44.000", quantityKg: "88.000", unitPrice: "100.00", priceUnitName: "maan", priceUnitKind: "fixed", priceMeasureKg: "4.400", lineTotal: "2000.00" },
] };
beforeEach(() => { mocks.getState.mockReturnValue({ status: "idle" }); mocks.getPurchasesWorkspace.mockResolvedValue(workspace); mocks.getPurchase.mockResolvedValue(purchase); });
afterEach(() => { vi.resetAllMocks(); mocks.pending = false; });

describe("purchase pages and draft form", () => {
  it("shows honest empty state and an available create action", async () => {
    const markup = renderToStaticMarkup(await PurchasesPage());
    expect(markup).toContain("No purchases yet.");
    expect(markup).toContain('href="/purchases/new"');
    expect(markup).not.toContain("<form");
  });
  it("shows saved supplier, total, currency and draft detail link", async () => {
    mocks.getPurchasesWorkspace.mockResolvedValue({ ...workspace, purchases: [purchase] });
    const markup = renderToStaticMarkup(await PurchasesPage());
    for (const text of ["Helmand Grain", "2,000.00", "AFN", "Draft", 'href="/purchases/purchase"']) expect(markup).toContain(text);
  });
  it("hides creation for read-only users", async () => {
    mocks.getPurchasesWorkspace.mockResolvedValue({ ...workspace, canManage: false });
    expect(renderToStaticMarkup(await PurchasesPage())).not.toContain('href="/purchases/new"');
  });
  it("displays historical quantity and price measures without later lifecycle controls", async () => {
    const markup = renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    for (const text of ["Helmand Grain", "Main warehouse", "Wheat", "44.000", "88.000", "4.400", "100.00", "2,000.00", "Draft"]) expect(markup).toContain(text);
    expect(markup).not.toMatch(/<form|Receive stock|Cancel purchase|Mark as ordered/);
  });
  it("preserves whole quantity zeros and exact large decimal display", async () => {
    mocks.getPurchase.mockResolvedValue({ ...purchase, items: [{ ...purchase.items[0], quantity: "10" }] });
    const markup = renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    expect(markup).toMatch(/>10<\/bdi>/);
    expect(renderToStaticMarkup(<PurchaseNumber value="999999999999999999.99" currency="PKR" />)).toContain("999,999,999,999,999,999.99");
  });
  it("labels controls, carries retry identity and keeps authority and calculated totals off the form", () => {
    const markup = renderToStaticMarkup(<PurchaseForm workspace={workspace} requestId="retry" />);
    expect(markup).toContain('name="requestId"');
    expect(markup).not.toMatch(/name="(organizationId|role|total|status|id)"/);
    expect(markup).toContain('name="quantity"');
    expect(markup).toContain('name="unitPrice"');
    const labels = [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((match) => match[1]);
    expect(labels.length).toBeGreaterThanOrEqual(7);
    for (const id of labels) expect(markup).toContain(`id="${id}"`);
    expect(markup).toContain("Add purchase line");
  });
  it("links item errors and summary, disables pending controls and explains conflicts/errors", () => {
    mocks.getState.mockReturnValue({ status: "invalid", fields: ["supplierId", "items.0.quantity", "items.0.unitPrice"] });
    const invalid = renderToStaticMarkup(<PurchaseForm workspace={workspace} requestId="retry" />);
    expect(invalid).toContain('tabindex="-1"'); expect(invalid).toContain('aria-invalid="true"');
    for (const [, id] of invalid.matchAll(/href="#([^"]+)"/g)) expect(invalid).toContain(`id="${id}"`);
    mocks.pending = true;
    expect(renderToStaticMarkup(<PurchaseForm workspace={workspace} requestId="retry" />)).toContain('<fieldset disabled=""');
    mocks.pending = false;
    for (const state of [{ status: "conflict" }, { status: "error", correlationId: "safe-ref" }] as PurchaseState[]) {
      mocks.getState.mockReturnValue(state);
      expect(renderToStaticMarkup(<PurchaseForm workspace={workspace} requestId="retry" />)).toContain('role="alert"');
    }
  });
  it("uses the installed recovery callback", () => {
    const retry = vi.fn(); expect(PurchasesError({ retry }).props.retry).toBe(retry);
  });
});
