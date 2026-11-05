import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryWorkspace } from "@/db/inventory";

const mocks = vi.hoisted(() => ({ getInventoryWorkspace: vi.fn(), requirePermission: vi.fn() }));
vi.mock("@/db/inventory", () => mocks);
vi.mock("@/db/authorization", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: React.ReactNode }) => children }));
import InventoryPage from "./page";
import InventoryError from "./error";
import InventoryLoading from "./loading";
import InventoryNotFound from "./not-found";

const balance = { productId: "wheat", productName: "Wheat <grain>", productActive: true, warehouseId: "main", warehouseName: "Main", warehouseActive: true, quantityKg: "92.401" };
const movement = { id: "movement", productId: "wheat", productName: "Wheat at receipt", warehouseName: "Main at receipt", quantityKg: "48.400", kind: "receipt" as const,
  createdAt: new Date("2026-11-03T12:00:00Z"), receiptId: "c210141a-fc42-4ddb-b4df-3ff6ab4083d4", purchaseId: "purchase", quantity: "1.000000000000000000", quantityUnitName: "bag", quantityMeasureKg: "48.400",
  reasonCode: null, reason: null, reference: null, performedByUserId: "user_owner" };
const workspace: InventoryWorkspace = { balances: [balance], movements: [movement], product: null, after: null, canReadPurchases: true, canCorrect: false, nextCursor: null };
beforeEach(() => { vi.resetAllMocks(); mocks.getInventoryWorkspace.mockResolvedValue(workspace); });

describe("inventory screen", () => {
  it("offers adjustments to owners and renders signed correction provenance", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, canCorrect: true, movements: [{ ...movement, kind: "adjustment", quantityKg: "-1.001", receiptId: null,
      purchaseId: null, quantity: null, quantityUnitName: null, quantityMeasureKg: null, reasonCode: "loss", reason: "Broken bags", reference: "Count 14", performedByUserId: "user_owner" }] });
    const html = renderToStaticMarkup(await InventoryPage());
    for (const text of ["-1.001", "Loss", "Broken bags", "Count 14", "user_owner", 'href="/inventory/adjust"']) expect(html).toContain(text);
    expect(html).not.toContain("+-"); expect(html).not.toContain("Receipt reference");
  });
  it("hides adjustment entry from other inventory readers", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, canCorrect: false });
    expect(renderToStaticMarkup(await InventoryPage())).not.toContain('href="/inventory/adjust"');
  });
  it("renders exact stock, receipt snapshots and the receipt's full reference", async () => {
    const html = renderToStaticMarkup(await InventoryPage());
    for (const text of ["Recorded stock", "Stock history", "92.401", "48.400", "Wheat &lt;grain&gt;", "Wheat at receipt", "Main at receipt", movement.receiptId]) expect(html).toContain(text);
    expect(html).toContain('href="/purchases/purchase"');
    expect(html).toContain("Outgoing stock is not yet recorded");
    expect(html).not.toMatch(/<form|stock valuation/i);
  });
  it("passes only product and cursor parameters to the server read", async () => {
    await InventoryPage({ searchParams: Promise.resolve({ productId: "wheat", after: "cursor", organizationId: "spoof" }) });
    expect(mocks.getInventoryWorkspace).toHaveBeenCalledExactlyOnceWith({ productId: "wheat", after: "cursor" });
  });
  it("preserves product scope on older/latest history links and offers all products", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, product: { id: "wheat", name: "Wheat" }, nextCursor: "cursor", after: "earlier" });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toContain('href="/inventory?productId=wheat&amp;after=cursor#stock-history"');
    expect(html).toContain('href="/inventory?productId=wheat#stock-history"');
    expect(html).toContain("Older movements"); expect(html).toContain("Latest movements"); expect(html).toContain("All products");
    expect(html).toContain('<nav aria-labelledby="stock-history-title"');
  });
  it("shows a useful first-run state without offering inaccessible purchase links", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, balances: [], movements: [], canReadPurchases: false });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toContain("No recorded stock yet"); expect(html).toContain("No stock movements yet");
    expect(html).not.toContain('href="/purchases'); expect(html).toContain('href="/products"');
  });
  it("keeps sales inventory readable without purchase links or financial values", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, canReadPurchases: false, movements: [{ ...movement, purchaseId: null }] });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toContain(movement.receiptId); expect(html).not.toContain('href="/purchases');
    expect(html).not.toMatch(/AFN|PKR|unit price/i);
  });
  it("marks inactive references without hiding recorded stock", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, balances: [{ ...balance, productActive: false, warehouseActive: false }] });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toContain("Inactive product"); expect(html).toContain("Inactive warehouse"); expect(html).toContain("92.401");
  });
  it("does not round large decimal balances through a JavaScript number", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, balances: [{ ...balance, quantityKg: "1999999999999999999.999" }] });
    expect(renderToStaticMarkup(await InventoryPage())).toContain("1,999,999,999,999,999,999.999");
  });
  it("keeps histories with no older rows readable and provides latest-history recovery", async () => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, movements: [], after: "last" });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toContain("No older movements"); expect(html).toContain("Latest movements"); expect(html).not.toContain("Older movements</");
  });
  it("shows accessible loading, error retry and unavailable-view recovery", () => {
    expect(renderToStaticMarkup(<InventoryLoading />)).toContain('role="status"');
    const retry = vi.fn(); expect(InventoryError({ retry }).props.retry).toBe(retry);
    expect(renderToStaticMarkup(<InventoryNotFound />)).toContain('href="/inventory"');
  });
  it.each(["10", "10.000000000000000000", "1.500000000000000000"])("trims fractional zero padding without changing entered quantity %s", async (quantity) => {
    mocks.getInventoryWorkspace.mockResolvedValue({ ...workspace, movements: [{ ...movement, quantity }] });
    const html = renderToStaticMarkup(await InventoryPage());
    expect(html).toMatch(quantity.startsWith("10") ? />10<\/bdi>/ : />1\.5<\/bdi>/);
  });
});
