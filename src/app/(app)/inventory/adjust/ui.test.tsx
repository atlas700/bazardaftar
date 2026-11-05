import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAdjustmentOptions: vi.fn(), recordAdjustment: vi.fn() }));
vi.mock("@/db/inventory-adjustments", () => mocks);
vi.mock("../adjustment-actions", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("gt-next/client", () => ({ T: ({ children }: { children: React.ReactNode }) => children, Var: ({ children }: { children: React.ReactNode }) => children, useGT: () => (text: string) => text }));
import AdjustmentPage from "./page";
beforeEach(() => { vi.resetAllMocks(); mocks.getAdjustmentOptions.mockResolvedValue({ organizationId: "org", products: [{ id: "wheat", name: "Wheat <grain>" }], warehouse: { id: "main", name: "Main" } }); });
describe("owner adjustment screen", () => {
  it("labels correction fields and requires explicit approval", async () => {
    const html = renderToStaticMarkup(await AdjustmentPage());
    for (const text of ["Record stock adjustment", "Wheat &lt;grain&gt;", "Main", "Opening stock", "Loss", "Spoilage", "Count correction", 'name="quantityKg"', 'name="reason"', 'name="reference"', 'name="requestId"', 'name="approved"', "As owner, I approve this stock adjustment", 'href="/inventory"']) expect(html).toContain(text);
    expect(html).toMatch(/name="approved"[^>]*required/); expect(html).not.toContain('name="organizationId"');
    expect(html).toContain("Negative stock is never allowed");
  });
  it.each([{ products: [] }, { warehouse: null }])("provides setup recovery before showing an unusable form: %j", async (patch) => {
    mocks.getAdjustmentOptions.mockResolvedValue({ organizationId: "org", products: [{ id: "wheat", name: "Wheat" }], warehouse: { id: "main", name: "Main" }, ...patch });
    const html = renderToStaticMarkup(await AdjustmentPage());
    expect(html).not.toContain("<form"); expect(html).toContain("active product and warehouse");
  });
});
