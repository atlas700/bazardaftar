import { afterEach, describe, expect, it, vi } from "vitest";

const { requirePermission } = vi.hoisted(() => ({ requirePermission: vi.fn() }));
vi.mock("@/db/authorization", () => ({ requirePermission }));
vi.mock("gt-next", () => ({ T: ({ children }: { children: unknown }) => children }));
vi.mock("@/db/dashboard", () => ({ getDashboard: async () => {
  await requirePermission("organization.read");
  return { capabilities: { purchases: false, inventory: true, balances: false, payments: false, createPurchase: false, recordPayment: false }, purchases: null, stock: [], balances: null, transactions: [] };
} }));
vi.mock("@/db/inventory", () => ({ getInventoryWorkspace: async () => {
  await requirePermission("inventory.read");
  return { balances: [], movements: [], product: null, after: null, nextCursor: null, canReadPurchases: false };
} }));
vi.mock("@/db/purchases", () => ({ getPurchasesWorkspace: async () => {
  await requirePermission("purchases.read");
  return { purchases: [], canManage: false };
} }));
vi.mock("@/db/workspace", () => ({ getWorkspaceSummary: async () => {
  await requirePermission("organization.read");
  return { name: "Business", role: "owner" };
} }));
vi.mock("@/db/supplier-payments", () => ({ getPaymentsWorkspace: async () => {
  await requirePermission("supplier_payments.read");
  return { suppliers: [], supplier: null, currency: "AFN", payments: [], payables: [], after: null, nextCursor: null };
} }));
vi.mock("@/db/supplier-statements", () => ({ getSupplierAccount: async () => {
  await requirePermission("supplier_balances.read");
  return { supplier: { id: "supplier", name: "Grain supplier", isActive: true }, currency: "AFN", balances: [], entries: [], allocations: [] };
} }));

import DashboardPage from "../app/(app)/dashboard/page";
import InventoryPage from "../app/(app)/inventory/page";
import PurchasesPage from "../app/(app)/purchases/page";
import SalesPage from "../app/(app)/sales/page";
import PaymentsPage from "../app/(app)/payments/page";
import SettingsPage from "../app/(app)/settings/page";
import StatementPage from "../app/(app)/suppliers/[id]/statement/page";

afterEach(() => vi.resetAllMocks());

describe.each([
  ["dashboard", DashboardPage, "organization.read"],
  ["inventory", InventoryPage, "inventory.read"],
  ["purchases", PurchasesPage, "purchases.read"],
  ["sales", SalesPage, "organization.read"],
  ["payments", PaymentsPage, "supplier_payments.read"],
  ["settings", SettingsPage, "organization.read"],
  ["supplier statement", () => StatementPage({ params: Promise.resolve({ id: "supplier" }) }), "supplier_balances.read"],
])("protected %s page", (_name, Page, permission) => {
  it("does not render when the permission guard denies access", async () => {
    const denied = new Error("Access denied");
    requirePermission.mockRejectedValue(denied);
    await expect(Page()).rejects.toBe(denied);
  });

  it("renders only after checking its action permission", async () => {
    requirePermission.mockResolvedValue({ userId: "user_123" });
    expect(await Page()).toBeTruthy();
    expect(requirePermission).toHaveBeenCalledExactlyOnceWith(permission);
  });
});
