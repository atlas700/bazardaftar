import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

const { organizations, users } = vi.hoisted(() => ({ organizations: {
  getOrganizationMembershipList: vi.fn(), getOrganizationInvitationList: vi.fn(),
  createOrganizationInvitation: vi.fn(), createOrganizationMembership: vi.fn(),
  deleteOrganizationMembership: vi.fn(), revokeOrganizationInvitation: vi.fn(),
}, users: { getOrganizationMembershipList: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => ({ organizations, users }) }));

import { addStaff, getStaffAccessOrganizations, getStaffInvitations, getStaffMemberships, inviteStaff, removeStaff, revokeStaffInvitation } from "./staff";

const member = { id: "member_a", organization: { id: "org_a", name: "Business A" }, publicUserData: { userId: "user_a", identifier: "+93000000000" } };
beforeEach(() => {
  organizations.getOrganizationMembershipList.mockResolvedValue({ data: [member], totalCount: 1 });
  organizations.getOrganizationInvitationList.mockResolvedValue({ data: [{ id: "inv_a", organizationId: "org_a",
    emailAddress: "staff@example.invalid", expiresAt: 1800000000000, url: "https://secret.invalid/ticket", privateMetadata: { secret: true } }], totalCount: 1 });
  users.getOrganizationMembershipList.mockResolvedValue({ data: [member], totalCount: 1 });
});
afterEach(() => vi.resetAllMocks());

describe("Clerk staff adapter", () => {
  it("returns only current scoped membership identity, never provider roles", async () => {
    expect(await getStaffMemberships("org_a")).toEqual([{ membershipId: "member_a", userId: "user_a", identifier: "+93000000000" }]);
    expect(organizations.getOrganizationMembershipList).toHaveBeenCalledWith({ organizationId: "org_a", limit: 100 });
  });
  it.each([
    { data: [member], totalCount: 2 },
    { data: [member, member], totalCount: 2 },
    { data: [{ ...member, organization: { id: "org_other" } }], totalCount: 1 },
    { data: [{ ...member, publicUserData: null }], totalCount: 1 },
  ])("rejects incomplete, duplicated, or mismatched membership data", async (response) => {
    organizations.getOrganizationMembershipList.mockResolvedValue(response);
    await expect(getStaffMemberships("org_a")).rejects.toThrow();
  });
  it("strips invitation URLs, metadata and other provider fields", async () => {
    expect(await getStaffInvitations("org_a")).toEqual([{ id: "inv_a", emailAddress: "staff@example.invalid", expiresAt: new Date(1800000000000).toISOString() }]);
    expect(organizations.getOrganizationInvitationList).toHaveBeenCalledWith({ organizationId: "org_a", status: ["pending"], limit: 100 });
  });
  it("rejects cross-organization and truncated invitations", async () => {
    await expect(getStaffInvitations("org_other")).rejects.toThrow();
    organizations.getOrganizationInvitationList.mockResolvedValue({ data: [], totalCount: 1 });
    await expect(getStaffInvitations("org_a")).rejects.toThrow();
  });
  it("sends only a 30-day Clerk member invitation without business grants", async () => {
    organizations.createOrganizationInvitation.mockResolvedValue({ id: "inv_created" });
    expect(await inviteStaff("org_a", "staff@example.invalid")).toBe("inv_created");
    expect(organizations.createOrganizationInvitation).toHaveBeenCalledExactlyOnceWith({
      organizationId: "org_a", emailAddress: "staff@example.invalid", role: "org:member", expiresInDays: 30,
    });
  });
  it("adds an existing account without notification and handles repeat submissions", async () => {
    organizations.getOrganizationMembershipList.mockResolvedValueOnce({ data: [] });
    await addStaff("org_a", "user_a");
    expect(organizations.createOrganizationMembership).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_a", userId: "user_a", role: "org:member" });
    await addStaff("org_a", "user_a");
    expect(organizations.createOrganizationMembership).toHaveBeenCalledTimes(1);
    expect(organizations.createOrganizationInvitation).not.toHaveBeenCalled();
  });
  it("recovers ambiguous create success only by exact organization and user", async () => {
    organizations.getOrganizationMembershipList.mockResolvedValueOnce({ data: [] });
    organizations.createOrganizationMembership.mockRejectedValue(new Error("timeout"));
    await expect(addStaff("org_a", "user_a")).resolves.toBeUndefined();
    await expect(addStaff("org_other", "user_a")).rejects.toThrow("timeout");
  });
  it("preserves framework control flow during create recovery", async () => {
    organizations.getOrganizationMembershipList.mockResolvedValue({ data: [] });
    organizations.createOrganizationMembership.mockImplementation(() => redirect("/sign-in"));
    await expect(addStaff("org_a", "user_a")).rejects.toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
  });
  it("uses organization-scoped removal and invitation revocation", async () => {
    await removeStaff("org_a", "user_a");
    await revokeStaffInvitation("org_a", "inv_a");
    expect(organizations.deleteOrganizationMembership).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_a", userId: "user_a" });
    expect(organizations.revokeOrganizationInvitation).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_a", invitationId: "inv_a" });
  });
  it("lists business choices only for the signed-in user", async () => {
    expect(await getStaffAccessOrganizations("user_a")).toEqual([{ id: "org_a", name: "Business A" }]);
    expect(users.getOrganizationMembershipList).toHaveBeenCalledWith({ userId: "user_a", limit: 100 });
    await expect(getStaffAccessOrganizations("user_other")).rejects.toThrow();
  });
});
