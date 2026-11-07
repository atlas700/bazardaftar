import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWorkspaceSummary: vi.fn(), getTenantContext: vi.fn(), requireSession: vi.fn() }));
vi.mock("@/db/workspace", () => mocks);
vi.mock("@/db/tenant", () => mocks);
vi.mock("@/auth/server", () => mocks);
vi.mock("@/db/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("@/auth/components", () => ({ SignOut: () => null }));
vi.mock("@/app/_components/locale-picker", () => ({ LocalePicker: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", redirect: vi.fn() }));
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children, useGT: () => (text: string) => text }));
import AppLayout from "./layout";
import SettingsPage from "./settings/page";
import { hasPermission } from "@/auth/permissions";

beforeEach(() => {
  mocks.requireSession.mockResolvedValue({ userId: "user_a" });
  mocks.getTenantContext.mockResolvedValue({ userId: "user_a", organizationId: "business_a", membershipId: "member_a" });
  mocks.getWorkspaceSummary.mockResolvedValue({ name: "Helmand Grain", role: "viewer" });
});
afterEach(() => vi.resetAllMocks());

describe("workspace identity and permitted actions", () => {
  it("puts mobile navigation in a menu-controlled sidebar instead of a scrolling navbar", async () => {
    const html = renderToStaticMarkup(await AppLayout({ children: "Records" }));
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("<dialog");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("offers a theme toggle in the workspace navbar", async () => {
    const html = renderToStaticMarkup(await AppLayout({ children: "Records" }));
    expect(html).toContain("Switch to dark theme");
    expect(html).toContain("Switch to light theme");
  });

  it.each(["Helmand Grain", "Second Business"])("identifies the verified active business %s with a selection link", async (name) => {
    mocks.getWorkspaceSummary.mockResolvedValue({ name, role: "viewer" });
    const html = renderToStaticMarkup(await AppLayout({ children: "Records" }));
    expect(html).toContain(name);
    expect(html).toContain('href="/join"');
  });
  it.each(["owner", "admin", "manager", "warehouse", "sales", "accountant", "viewer"])("shows staff management only to owners/admins: %s", async (role) => {
    mocks.getWorkspaceSummary.mockResolvedValue({ name: "Business", role });
    const settings = renderToStaticMarkup(await SettingsPage());
    expect(settings.includes('href="/settings/staff"')).toBe(role === "owner" || role === "admin");
    expect(settings.includes('href="/suppliers"')).toBe(hasPermission(role, "suppliers.read"));
    expect(settings).toContain('href="/settings/warehouse"');
  });
});
