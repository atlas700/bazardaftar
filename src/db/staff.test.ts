import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), query: vi.fn(), getStaffMemberships: vi.fn(),
  getStaffInvitations: vi.fn(), inviteStaff: vi.fn(), addStaff: vi.fn(), removeStaff: vi.fn(), revokeStaffInvitation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("@/auth/staff", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client();
  client.query = mocks.query;
  return { db: drizzle({ client }) };
});

import { getStaffWorkspace, manageStaff } from "./staff";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
let grants: string[][];
const members = [{ membershipId: "member_a", userId: "user_a", identifier: "A" }, { membershipId: "member_b", userId: "user_b", identifier: "B" }];
beforeEach(() => {
  grants = [[organizationId, "member_a", "user_a", "owner", "2026-10-27"], [organizationId, "member_b", "user_b", "viewer", "2026-10-27"]];
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getStaffMemberships.mockResolvedValue(members);
  mocks.getStaffInvitations.mockResolvedValue([]);
  mocks.inviteStaff.mockResolvedValue("inv_created");
  mocks.query.mockImplementation(async (config: string | { text: string }, values: unknown[]) => {
    const text = typeof config === "string" ? config : config.text;
    if (text.startsWith("select") && text.includes('"organizations"')) return { rows: [[organizationId, "org_a", "2026-10-27"]] };
    if (text.startsWith("select")) return { rows: grants };
    if (text.startsWith("insert")) return { rows: [[values[1]]] };
    return { rows: [] };
  });
});
afterEach(() => vi.resetAllMocks());

describe("staff mutation boundary", () => {
  it.each([null, {}, { operation: "role", membershipId: "member_b", role: "superuser" }, { operation: "invite", emailAddress: "invalid" }, { operation: "add", userId: "bad" }])("rejects invalid input before acquiring a lock", async (input) => {
    expect(await manageStaff(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("staff.manage");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("preserves permission denials before reading or mutating", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));
    await expect(manageStaff({ operation: "add", userId: "user_b" })).rejects.toThrow("denied");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(["role", "deactivate"])("blocks %s of the last active owner", async (operation) => {
    expect(await manageStaff({ operation, membershipId: "member_a", role: "viewer" })).toEqual({ status: "last-owner" });
    expect(mocks.removeStaff).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.some(([query, values]) => query.text?.startsWith("insert") && values.includes("completed"))).toBe(false);
  });
  it("does not count stale owners or assignments bound to a different user", async () => {
    grants.push([organizationId, "member_gone", "user_gone", "owner", "2026-10-27"]);
    grants[1][2] = "user_other";
    grants[1][3] = "owner";
    expect(await manageStaff({ operation: "deactivate", membershipId: "member_a" })).toEqual({ status: "last-owner" });
  });
  it.each([
    { operation: "role", membershipId: "member_b", role: "owner" },
    { operation: "role", membershipId: "member_a", role: "viewer" },
    { operation: "deactivate", membershipId: "member_a" },
  ])("prevents admin ownership changes: %j", async (command) => {
    grants[1][3] = "admin";
    mocks.requirePermission.mockResolvedValue({ ...tenant, userId: "user_b", membershipId: "member_b" });
    expect(await manageStaff(command)).toEqual({ status: "owner-required" });
  });
  it("locks the organization and rechecks a demoted or removed queued actor", async () => {
    grants[0][3] = "viewer";
    await expect(manageStaff({ operation: "add", userId: "user_c" })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query, values]) => query.text?.includes('for no key update') && values[0] === organizationId)).toBe(true);
    expect(mocks.addStaff).not.toHaveBeenCalled();
    grants[0][3] = "owner";
    mocks.getStaffMemberships.mockResolvedValue([members[1]]);
    await expect(manageStaff({ operation: "add", userId: "user_c" })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("rejects a target outside the verified organization's memberships", async () => {
    expect(await manageStaff({ operation: "role", membershipId: "member_other_org", role: "admin", organizationId: "attacker" })).toEqual({ status: "conflict" });
    expect(mocks.getStaffMemberships).toHaveBeenCalledWith("org_a");
  });
  it("assigns an explicit business role with parameterized tenant and identity", async () => {
    expect(await manageStaff({ operation: "role", membershipId: "member_b", role: "manager", userId: "attacker", organizationId: "attacker" })).toEqual({ status: "success" });
    const call = mocks.query.mock.calls.find(([query]) => query.text?.startsWith("insert"));
    expect(call?.[1]).toEqual([organizationId, "member_b", "user_b", "manager", "manager", "user_b", organizationId]);
  });
  it("removes membership while keeping the old local grant", async () => {
    grants[1][3] = "owner";
    expect(await manageStaff({ operation: "deactivate", membershipId: "member_b" })).toEqual({ status: "success" });
    expect(mocks.removeStaff).toHaveBeenCalledExactlyOnceWith("org_a", "user_b");
    expect(mocks.query.mock.calls.some(([query]) => query.text?.startsWith("delete"))).toBe(false);
  });
  it("adds membership without automatically granting a business role", async () => {
    expect(await manageStaff({ operation: "add", userId: "user_c" })).toEqual({ status: "success" });
    expect(mocks.addStaff).toHaveBeenCalledExactlyOnceWith("org_a", "user_c");
    expect(mocks.query.mock.calls.some(([query]) => query.text?.startsWith('insert into "organization_role_assignments"'))).toBe(false);
  });
  it("sends a new invitation when no live duplicate exists", async () => {
    mocks.getStaffInvitations.mockResolvedValue([{ id: "inv_expired", emailAddress: "staff@example.invalid", expiresAt: "2020-01-01T00:00:00.000Z" }]);
    expect(await manageStaff({ operation: "invite", emailAddress: "staff@example.invalid" })).toEqual({ status: "success" });
    expect(mocks.inviteStaff).toHaveBeenCalledExactlyOnceWith("org_a", "staff@example.invalid");
  });
  it("rejects an inconsistent stored identity and a conditional upsert that saved nothing", async () => {
    grants[1][2] = "user_other";
    expect(await manageStaff({ operation: "role", membershipId: "member_b", role: "manager" })).toEqual({ status: "conflict" });
    grants[1][2] = "user_b";
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows: query.text.startsWith("select") ? (
      query.text.includes('"organizations"') ? [[organizationId, "org_a", "2026-10-27"]] : grants
    ) : [] }));
    expect(await manageStaff({ operation: "role", membershipId: "member_b", role: "manager" })).toEqual({ status: "conflict" });
  });
  it("reuses a live invitation on retry and only revokes an invitation in this organization", async () => {
    mocks.getStaffInvitations.mockResolvedValue([{ id: "inv_a", emailAddress: "STAFF@example.invalid", expiresAt: "2099-01-01T00:00:00.000Z" }]);
    expect(await manageStaff({ operation: "invite", emailAddress: "staff@example.invalid" })).toEqual({ status: "success" });
    expect(mocks.inviteStaff).not.toHaveBeenCalled();
    expect(await manageStaff({ operation: "revoke", invitationId: "inv_other" })).toEqual({ status: "conflict" });
    expect(mocks.revokeStaffInvitation).not.toHaveBeenCalled();
    expect(await manageStaff({ operation: "revoke", invitationId: "inv_a" })).toEqual({ status: "success" });
    expect(mocks.revokeStaffInvitation).toHaveBeenCalledWith("org_a", "inv_a");
  });
  it("rolls back and propagates remote failure for sanitized action handling", async () => {
    mocks.removeStaff.mockRejectedValue(new Error("provider timeout"));
    await expect(manageStaff({ operation: "deactivate", membershipId: "member_b" })).rejects.toThrow("provider timeout");
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ text: "rollback" }), []);
  });
  it("lists only active exact grants and fails closed on read outages", async () => {
    grants[1][2] = "user_other";
    const result = await getStaffWorkspace();
    expect(result.members.map((member) => member.role)).toEqual(["owner", null]);
    expect(mocks.requirePermission).toHaveBeenCalledWith("staff.read");
    mocks.getStaffMemberships.mockRejectedValue(new Error("private provider details"));
    await expect(getStaffWorkspace()).rejects.toThrow(/^Staff access unavailable\.$/);
  });
});
