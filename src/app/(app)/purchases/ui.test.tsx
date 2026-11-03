import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseState } from "@/db/purchases";

const mocks = vi.hoisted(() => ({ getPurchasesWorkspace: vi.fn(), getPurchase: vi.fn(), getState: vi.fn<() => PurchaseState>(), pending: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("@/db/purchases", () => mocks);
vi.mock("./actions", () => ({ createPurchase: vi.fn(), changePurchase: vi.fn() }));
vi.mock("gt-next", () => ({ useLocaleDirection: () => "rtl", useGT: () => (text: string) => text, T: ({ children }: { children: ReactNode }) => children, Var: ({ children }: { children: ReactNode }) => children }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useActionState: () => [mocks.getState(), () => {}, mocks.pending] }));
import PurchasesPage from "./page";
import PurchasePage from "./[id]/page";
import { PurchaseForm } from "./_components/purchase-form";
import PurchasesError from "./error";
import { PurchaseNumber } from "./_components/purchase-number";
import EditPurchasePage from "./[id]/edit/page";
import { PurchaseLifecycle } from "./_components/purchase-lifecycle";

const workspace = { organizationId: "business", canManage: true, purchases: [], suppliers: [{ id: "supplier", name: "Helmand Grain" }],
  warehouse: { id: "warehouse", name: "Main warehouse" }, products: [{ id: "wheat", name: "Wheat", unitId: "kg" }],
  units: [{ id: "kg", name: "kg", kind: "fixed" as const, kilogramsPerUnit: "1.000" }, { id: "bag", name: "bag", kind: "bag" as const, kilogramsPerUnit: null }] };
const purchase = { id: "purchase", organizationId: "business", supplierId: "supplier", warehouseId: "warehouse", canManage: true, canCancel: true, revision: 1,
  orderedAt: null, cancelledAt: null, cancelledByUserId: null, cancelledByMembershipId: null, cancellationReason: null, orderedByUserId: null, orderedByMembershipId: null,
  updatedAt: new Date("2026-11-02T07:00:00Z"), supplierName: "Helmand Grain", warehouseName: "Main warehouse", status: "draft" as const, total: "2000.00", currency: "AFN" as const, createdAt: new Date("2026-11-02T07:00:00Z"), items: [
  { id: "line", lineNumber: 1, productId: "wheat", quantityUnitId: "bag", priceUnitId: "kg", productName: "Wheat", productSku: "W-1", quantity: "2.000000000000000000", quantityUnitName: "bag", quantityUnitKind: "bag" as const, quantityMeasureKg: "44.000", quantityKg: "88.000", unitPrice: "100.00", priceUnitName: "maan", priceUnitKind: "fixed" as const, priceMeasureKg: "4.400", lineTotal: "2000.00" },
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
  it("displays historical measures with permitted lifecycle controls and no receipt controls", async () => {
    const markup = renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    for (const text of ["Helmand Grain", "Main warehouse", "Wheat", "44.000", "88.000", "4.400", "100.00", "2,000.00", "Draft"]) expect(markup).toContain(text);
    expect(markup).toContain('href="/purchases/purchase/edit"');
    expect(markup).toContain("Mark as ordered"); expect(markup).toContain("Cancel purchase");
    expect(markup).not.toMatch(/Receive stock/);
  });
  it.each(["ordered", "cancelled"])("renders %s truthfully in register/detail and hides editing", async (status) => {
    const changed = { ...purchase, status, orderedAt: new Date(), cancelledAt: status === "cancelled" ? new Date() : null,
      cancellationReason: status === "cancelled" ? "Supplier <cannot> deliver" : null };
    mocks.getPurchase.mockResolvedValue(changed); mocks.getPurchasesWorkspace.mockResolvedValue({ ...workspace, purchases: [changed] });
    const detail = renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    const register = renderToStaticMarkup(await PurchasesPage());
    expect(detail).toContain(status === "ordered" ? "Ordered" : "Cancelled");
    expect(register).toContain(status === "ordered" ? "Ordered" : "Cancelled");
    expect(detail).not.toMatch(/Edit purchase draft|Mark as ordered/);
    if (status === "cancelled") { expect(detail).toContain("Supplier &lt;cannot&gt; deliver"); expect(detail).not.toContain("Cancel purchase"); }
  });
  it("keeps read-only detail free of lifecycle mutations", async () => {
    mocks.getPurchase.mockResolvedValue({ ...purchase, canManage: false, canCancel: false });
    expect(renderToStaticMarkup(await PurchasePage({ params: Promise.resolve({ id: "purchase" }) }))).not.toMatch(/<form|Edit purchase draft/);
  });
  it("loads the saved draft into the shared editor with revision, line IDs and actual bag weight", async () => {
    const markup = renderToStaticMarkup(await EditPurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    for (const text of ['name="revision" value="1"', 'name="savedItemId" value="line"', 'name="action" value="edit"', 'value="44.000"', "Save changes", "Saved measure weights stay with unchanged selections"]) expect(markup).toContain(text);
  });
  it("rejects editing terminal purchases and preserves history when current selections are unavailable", async () => {
    mocks.getPurchase.mockResolvedValue({ ...purchase, status: "ordered" });
    await expect(EditPurchasePage({ params: Promise.resolve({ id: "purchase" }) })).rejects.toHaveProperty("digest", expect.stringContaining("/purchases/purchase"));
    mocks.getPurchase.mockResolvedValue(purchase); mocks.getPurchasesWorkspace.mockResolvedValue({ ...workspace, suppliers: [], products: [], units: [], warehouse: null });
    const markup = renderToStaticMarkup(await EditPurchasePage({ params: Promise.resolve({ id: "purchase" }) }));
    expect(markup).toContain("Some saved selections are inactive or unavailable");
    expect(markup).toContain('href="/purchases/purchase"');
  });
  it("labels cancellation reason, requires confirmation, disables pending controls, and offers stale-state recovery", () => {
    const props = { purchase, requestId: "retry" };
    const markup = renderToStaticMarkup(<PurchaseLifecycle {...props} />);
    expect(markup).toMatch(/<label[^>]*for=/); expect(markup).toContain('name="reason"');
    expect(markup).toContain('type="button"'); expect(markup).toContain('name="revision" value="1"');
    mocks.pending = true; expect(renderToStaticMarkup(<PurchaseLifecycle {...props} />)).toContain('<fieldset disabled=""');
    mocks.pending = false; mocks.getState.mockReturnValue({ status: "conflict" });
    expect(renderToStaticMarkup(<PurchaseLifecycle {...props} />)).toContain("Reload purchase");
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
