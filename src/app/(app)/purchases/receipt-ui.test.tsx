import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptState } from "@/db/receipts";
const mocks = vi.hoisted(() => ({ state: { status: "idle" } as ReceiptState, pending: false }));
vi.mock("./receipt-actions", () => ({ receivePurchase: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useActionState: () => [mocks.state, () => {}, mocks.pending] }));
vi.mock("gt-next", () => ({ useGT: () => (text: string) => text, useLocaleDirection: () => "rtl", T: ({ children }: { children: ReactNode }) => children, Var: ({ children }: { children: ReactNode }) => children }));
import { ReceiptForm } from "./_components/receipt-form";
const purchase = { id: "purchase", revision: 2, canApproveVariance: true, items: [{ id: "line", productName: "Wheat", quantityKg: "3.000", receivedQuantityKg: "1.000",
  quantityUnitId: "kg", quantityUnitName: "kg", quantityUnitKind: "fixed" as const, quantityMeasureKg: "1.000" }] };
const units = [{ id: "kg", name: "kg", kind: "fixed" as const, kilogramsPerUnit: "1.000" }];
beforeEach(() => { mocks.state = { status: "idle" }; mocks.pending = false; });
describe("receipt form", () => {
  it("shows agreed and already received weights with labelled inputs and no new price input", () => {
    const html = renderToStaticMarkup(<ReceiptForm purchase={purchase} units={units} requestId="request" />);
    for (const text of ["Accept delivery", "Wheat", "3.000", "1.000", "Quantity received", 'name="purchaseItemId" value="line"', 'name="requestId" value="request"', 'name="revision" value="2"']) expect(html).toContain(text);
    expect(html).not.toContain('name="unitPrice"');
    expect(html).toContain('name="approveVariance"');
  });
  it("never offers owner approval to a warehouse operator", () => {
    const html = renderToStaticMarkup(<ReceiptForm purchase={{ ...purchase, canApproveVariance: false }} units={units} requestId="request" />);
    expect(html).not.toContain('name="approveVariance"'); expect(html).toContain("owner");
  });
  it("links inline quantity errors and retains form identity", () => {
    mocks.state = { status: "invalid", fields: ["items.0.quantity"] };
    const html = renderToStaticMarkup(<ReceiptForm purchase={purchase} units={units} requestId="same" />);
    expect(html).toContain('role="alert"'); expect(html).toContain('aria-invalid="true"'); expect(html).toContain('href="#'); expect(html).toContain('name="requestId" value="same"');
  });
  it("disables pending inputs and supplies safe conflict/error recovery", () => {
    mocks.pending = true;
    expect(renderToStaticMarkup(<ReceiptForm purchase={purchase} units={units} requestId="request" />)).toContain("disabled");
    mocks.state = { status: "conflict" };
    expect(renderToStaticMarkup(<ReceiptForm purchase={purchase} units={units} requestId="request" />)).toContain("Reload purchase");
    mocks.state = { status: "error", correlationId: "safe-reference" };
    expect(renderToStaticMarkup(<ReceiptForm purchase={purchase} units={units} requestId="request" />)).toContain("safe-reference");
  });
});
