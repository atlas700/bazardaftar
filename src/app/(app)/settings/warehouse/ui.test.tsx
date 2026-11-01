import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WarehouseState } from "@/db/warehouses";

const mocks = vi.hoisted(() => ({ getWarehouseWorkspace: vi.fn(), getState: vi.fn<() => WarehouseState>(), pending: false }));
vi.mock("@/db/warehouses", () => mocks);
vi.mock("./actions", () => ({ updateWarehouse: vi.fn() }));
vi.mock("gt-next", () => ({ useGT: () => (text: string) => text, T: ({ children }: { children: ReactNode }) => children, Var: ({ children }: { children: ReactNode }) => children }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useActionState: () => [mocks.getState(), () => {}, mocks.pending] }));
import WarehousePage from "./page";
import { WarehouseForm } from "./_components/warehouse-form";
import WarehouseError from "./error";

const warehouse = { id: "warehouse", name: "Main warehouse", location: "Lashkar Gah", isActive: true };
beforeEach(() => {
  mocks.getState.mockReturnValue({ status: "idle" });
  mocks.getWarehouseWorkspace.mockResolvedValue({ warehouse, canManage: true });
});
afterEach(() => { vi.resetAllMocks(); mocks.pending = false; });

describe("warehouse settings", () => {
  it("shows setup with linked labels and a safe form identifier", async () => {
    const markup = renderToStaticMarkup(await WarehousePage());
    expect(markup).toContain('href="/settings"'); expect(markup).toContain("Main warehouse");
    expect(markup).toContain('name="warehouseId"'); expect(markup).not.toContain('name="id"');
    expect(markup).not.toContain('name="organizationId"');
    const labels = [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)];
    expect(labels).toHaveLength(2); for (const [, id] of labels) expect(markup).toContain(`id="${id}"`);
  });
  it("offers first setup but never another warehouse for an inactive record", async () => {
    mocks.getWarehouseWorkspace.mockResolvedValue({ warehouse: null, canManage: true });
    expect(renderToStaticMarkup(await WarehousePage())).toContain('value="create-warehouse"');
    mocks.getWarehouseWorkspace.mockResolvedValue({ warehouse: { ...warehouse, isActive: false }, canManage: true });
    const markup = renderToStaticMarkup(await WarehousePage());
    expect(markup).toContain("Inactive"); expect(markup).toContain('value="activate-warehouse"');
    expect(markup).not.toContain('value="create-warehouse"');
  });
  it("shows read-only and missing-location states without write controls", async () => {
    mocks.getWarehouseWorkspace.mockResolvedValue({ warehouse: { ...warehouse, location: null }, canManage: false });
    const markup = renderToStaticMarkup(await WarehousePage());
    expect(markup).toContain("Not specified"); expect(markup).toContain("Only owners and admins"); expect(markup).not.toContain("<form");
    mocks.getWarehouseWorkspace.mockResolvedValue({ warehouse: null, canManage: false });
    expect(renderToStaticMarkup(await WarehousePage())).toContain("No warehouse set up yet.");
  });
  it("retains values, links field errors, and disables pending writes", () => {
    mocks.getState.mockReturnValue({ status: "invalid", fields: ["name", "location"] });
    const markup = renderToStaticMarkup(<WarehouseForm warehouse={warehouse} />);
    expect(markup).toContain('value="Main warehouse"'); expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('tabindex="-1"'); expect((markup.match(/href="#/g) ?? []).length).toBe(2);
    mocks.pending = true;
    expect(renderToStaticMarkup(<WarehouseForm warehouse={warehouse} />)).toContain('<fieldset disabled=""');
  });
  it("announces safe action outcomes and wires the current retry API", () => {
    for (const state of [{ status: "success" }, { status: "exists" }, { status: "conflict" }, { status: "error", correlationId: "safe-ref" }] as WarehouseState[]) {
      mocks.getState.mockReturnValue(state);
      expect(renderToStaticMarkup(<WarehouseForm warehouse={warehouse} />)).toContain(state.status === "success" ? 'role="status"' : 'role="alert"');
    }
    const retry = vi.fn(); expect(WarehouseError({ retry }).props.retry).toBe(retry);
  });
});
