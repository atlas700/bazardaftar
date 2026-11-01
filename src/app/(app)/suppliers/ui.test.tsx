import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupplierState } from "@/db/suppliers";

const mocks = vi.hoisted(() => ({ getSuppliersWorkspace: vi.fn(), getSupplier: vi.fn(), getState: vi.fn<() => SupplierState>(), pending: false }));
vi.mock("@/db/suppliers", () => mocks);
vi.mock("./actions", () => ({ updateSupplier: vi.fn() }));
vi.mock("gt-next", () => ({ useLocaleDirection: () => "rtl", useGT: () => (text: string) => text, T: ({ children }: { children: ReactNode }) => children, Var: ({ children }: { children: ReactNode }) => children }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(), useActionState: () => [mocks.getState(), () => {}, mocks.pending],
}));
import SuppliersPage from "./page";
import SupplierPage from "./[id]/page";
import { SupplierForm } from "./_components/supplier-form";
import SuppliersError from "./error";

const supplier = { id: "supplier", name: "Helmand Grain", phone: "۰۷۰۰۱۲۳۴۵۶", location: "Lashkar Gah", type: "business" as const,
  notes: "Call before delivery", paymentTerms: "By agreement", isActive: true };
beforeEach(() => {
  mocks.getState.mockReturnValue({ status: "idle" });
  mocks.getSuppliersWorkspace.mockResolvedValue({ suppliers: [supplier], canManage: true });
  mocks.getSupplier.mockResolvedValue(supplier);
});
afterEach(() => { vi.resetAllMocks(); mocks.pending = false; });

describe("supplier pages and form", () => {
  it("passes Next.js 16.4's retry callback to the recovery control", () => {
    const retry = vi.fn();
    expect(SuppliersError({ retry }).props.retry).toBe(retry);
  });
  it("puts the directory before creation and labels every control", async () => {
    const markup = renderToStaticMarkup(await SuppliersPage());
    expect(markup).toContain('href="/suppliers/supplier"');
    expect(markup.indexOf("Supplier directory")).toBeLessThan(markup.indexOf("<form"));
    expect(markup).toContain("Helmand Grain"); expect(markup).toContain("Lashkar Gah");
    expect(markup).toContain('value="create-supplier"');
    expect(markup).not.toContain('name="organizationId"');
    expect(markup).not.toContain('name="balance"');
    const ids = [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(6);
    for (const id of ids) expect(markup).toContain(`id="${id}"`);
    expect(markup).toContain('data-slot="select-trigger"');
    expect(markup).toContain('dir="rtl"');
  });
  it("provides a useful empty state", async () => {
    mocks.getSuppliersWorkspace.mockResolvedValue({ suppliers: [], canManage: true });
    const markup = renderToStaticMarkup(await SuppliersPage());
    expect(markup).toContain("No suppliers yet."); expect(markup).toContain('href="#add-supplier"');
  });
  it("hides writes on both read-only pages", async () => {
    mocks.getSuppliersWorkspace.mockResolvedValue({ suppliers: [supplier], canManage: false });
    for (const view of [await SuppliersPage(), await SupplierPage({ params: Promise.resolve({ id: supplier.id }) })]) {
      const markup = renderToStaticMarkup(view);
      expect(markup).toContain("Helmand Grain"); expect(markup).not.toContain("<form");
    }
  });
  it("shows contact details, edits and confirmed deactivation, retaining inactive records", async () => {
    const active = renderToStaticMarkup(await SupplierPage({ params: Promise.resolve({ id: supplier.id }) }));
    expect(mocks.getSupplier).toHaveBeenCalledWith(supplier.id);
    for (const text of ["Edit supplier", "Call before delivery", "By agreement", 'value="update-supplier"', 'value="deactivate-supplier"', 'formNoValidate=""']) expect(active).toContain(text);
    expect(active).toContain('name="supplierId"');
    expect(active).not.toContain('name="id"');
    mocks.getSupplier.mockResolvedValue({ ...supplier, isActive: false });
    const inactive = renderToStaticMarkup(await SupplierPage({ params: Promise.resolve({ id: supplier.id }) }));
    expect(inactive).toContain("Inactive"); expect(inactive).toContain("record is retained"); expect(inactive).not.toContain("<form");
  });
  it("shows honest missing contact values and escapes untrusted notes", async () => {
    mocks.getSupplier.mockResolvedValue({ ...supplier, phone: null, location: null, type: null, paymentTerms: null, notes: "<script>alert(1)</script>" });
    const markup = renderToStaticMarkup(await SupplierPage({ params: Promise.resolve({ id: supplier.id }) }));
    expect(markup).toContain("Not specified"); expect(markup).toContain("&lt;script&gt;"); expect(markup).not.toContain("<script>alert");
  });
  it("retains values and links errors to each invalid field and a summary", () => {
    mocks.getState.mockReturnValue({ status: "invalid", fields: ["name", "phone", "location", "type", "notes", "paymentTerms"] });
    const markup = renderToStaticMarkup(<SupplierForm supplier={supplier} />);
    expect(markup).toContain('value="Helmand Grain"'); expect(markup).toContain("Call before delivery");
    expect(markup).toContain('aria-invalid="true"'); expect(markup).toContain('tabindex="-1"');
    for (const id of [...markup.matchAll(/aria-describedby="([^"]+-error)"/g)].map((match) => match[1])) expect(markup).toContain(`id="${id}"`);
    expect((markup.match(/href="#/g) ?? []).length).toBe(6);
  });
  it("disables pending controls including the Radix select and announces safe outcomes", () => {
    mocks.pending = true;
    const pending = renderToStaticMarkup(<SupplierForm />);
    expect(pending).toContain('aria-busy="true"'); expect(pending).toContain('<fieldset disabled=""');
    expect(pending).toMatch(/<button[^>]*role="combobox"[^>]*disabled=""/);
    mocks.pending = false;
    for (const state of [{ status: "success" }, { status: "duplicate" }, { status: "conflict" }, { status: "error", correlationId: "safe-ref" }] as SupplierState[]) {
      mocks.getState.mockReturnValue(state);
      expect(renderToStaticMarkup(<SupplierForm supplier={supplier} />)).toContain(state.status === "success" ? 'role="status"' : 'role="alert"');
    }
  });
});
