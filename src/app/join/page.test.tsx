import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getStaffAccessOrganizations: vi.fn() }));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/staff", () => mocks);
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/auth/components", () => ({ SignOut: () => null }));
vi.mock("@/app/_components/locale-picker", () => ({ LocalePicker: () => <select aria-label="Language" /> }));
vi.mock("@/auth/organization-activation", () => ({ OrganizationActivation: ({ organizationId }: { organizationId: string }) => <span data-activation={organizationId} /> }));

import StaffAccessPage from "./page";

beforeEach(() => { mocks.requireSession.mockResolvedValue({ userId: "user_current" }); mocks.getStaffAccessOrganizations.mockResolvedValue([]); });
afterEach(() => vi.resetAllMocks());

describe("staff access entry", () => {
  it("requires sign-in before reading any memberships", async () => {
    mocks.requireSession.mockRejectedValue(new Error("sign-in"));
    await expect(StaffAccessPage()).rejects.toThrow("sign-in");
    expect(mocks.getStaffAccessOrganizations).not.toHaveBeenCalled();
  });
  it("shows only the caller's account ID and explains the manual join process", async () => {
    const markup = renderToStaticMarkup(await StaffAccessPage());
    expect(mocks.getStaffAccessOrganizations).toHaveBeenCalledExactlyOnceWith("user_current");
    expect(markup).toContain("user_current");
    expect(markup).toContain("assign a business role");
    expect(markup).toContain("You have not joined a business yet");
  });
  it("offers activation for current provider memberships and sanitizes outages", async () => {
    mocks.getStaffAccessOrganizations.mockResolvedValue([{ id: "org_current", name: "Business" }]);
    expect(renderToStaticMarkup(await StaffAccessPage())).toContain('data-activation="org_current"');
    mocks.getStaffAccessOrganizations.mockRejectedValue(new Error("private data"));
    await expect(StaffAccessPage()).rejects.toThrow(/^Staff access unavailable\.$/);
  });
});
vi.mock("server-only", () => ({}));
