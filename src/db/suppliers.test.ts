import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), getActiveOrganizationMembership: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client(); client.query = mocks.query;
  return { db: drizzle({ client }) };
});
import { getSupplier, getSuppliersWorkspace, manageSupplier } from "./suppliers";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const id = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
const command = { operation: "create-supplier", name: "Helmand Grain" };
function rows(query: { text: string }) {
  if (query.text.startsWith('insert into "suppliers"')) return [[id]];
  if (query.text.includes('from "organizations"')) return [[organizationId, "org_a"]];
  if (query.text.includes('from "organization_role_assignments"')) return [["owner"]];
  return [];
}
beforeEach(() => {
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ ...tenant, clerkOrganizationId: "org_a" });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows: rows(query) }));
});
afterEach(() => vi.resetAllMocks());

describe("supplier service boundary", () => {
  it.each([{ ...command, name: " " }, { ...command, name: "x".repeat(81) },
    { ...command, phone: "abc" }, { ...command, phone: "1".repeat(41) }, { ...command, phone: 123 },
    { ...command, location: "x".repeat(201) }, { ...command, notes: "x".repeat(2001) },
    { ...command, paymentTerms: "x".repeat(501) }, { operation: "deactivate-supplier", id: "bad" },
    { ...command, type: "farmer" }, { ...command, type: "" }, { ...command, notes: 42 },
  ])("rejects invalid fields before querying: %j", async (input) => {
    expect(await manageSupplier(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("suppliers.manage");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("parameterizes contacts, trims fields and ignores supplied authority and balance", async () => {
    const name = "x'); delete from suppliers; --";
    expect(await manageSupplier({ ...command, name: ` ${name} `, phone: " +93 (0) 700-123-456 ",
      location: " Lashkar Gah ", notes: " Contact first ", paymentTerms: " By agreement ",
      organizationId: "attacker", balance: "900" })).toEqual({ status: "success" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))!;
    expect(query.text).not.toContain(name); expect(query.text).not.toContain("balance");
    expect(values).toEqual(expect.arrayContaining([organizationId, name, "+93 (0) 700-123-456", "Lashkar Gah", "Contact first", "By agreement"]));
    expect(values).not.toContain("attacker");
    expect(mocks.query.mock.calls.some(([query]) => query.text.includes("for update"))).toBe(true);
  });
  it("stores blank or omitted optional contact fields as null", async () => {
    expect(await manageSupplier({ ...command, phone: " ", location: "", notes: null })).toEqual({ status: "success" });
    const values = mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))![1];
    expect(values.filter((value: unknown) => value === null).length).toBeGreaterThanOrEqual(4);
  });
  it.each(["individual", "business"])("accepts the approved descriptive supplier type %s", async (type) => {
    expect(await manageSupplier({ ...command, type, phone: "۰۷۰۰۱۲۳۴۵۶" })).toEqual({ status: "success" });
    expect(mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))![1]).toContain(type);
  });
  it("maps only the expected unique-name conflict and propagates other write failures", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => {
      if (query.text.startsWith("insert")) throw Object.assign(new Error("private"), { code: "23505", constraint: "suppliers_organization_name" });
      return { rows: rows(query) };
    });
    expect(await manageSupplier(command)).toEqual({ status: "duplicate" });
    mocks.query.mockRejectedValue(new Error("unexpected"));
    await expect(manageSupplier(command)).rejects.toThrow();
  });
  it.each(["update-supplier", "deactivate-supplier"])("scopes %s to an active supplier in the server tenant", async (operation) => {
    expect(await manageSupplier({ ...command, operation, id })).toEqual({ status: "conflict" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("update"))!;
    expect(query.text).toContain('"suppliers"."organization_id" =');
    expect(query.text).toContain('"suppliers"."is_active" =');
    expect(values).toEqual(expect.arrayContaining([organizationId, id, true]));
  });
  it.each([null, { ...tenant, clerkOrganizationId: "other" },
    { ...tenant, clerkOrganizationId: "org_a", membershipId: "other" },
    { ...tenant, clerkOrganizationId: "org_a", userId: "other" },
  ])("denies changed provider authority after waiting: %j", async (current) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(current);
    await expect(manageSupplier(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => /^(insert|update)/.test(query.text))).toBe(false);
  });
  it("denies a revoked local grant on the transaction connection", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
      query.text.includes('from "organization_role_assignments"') ? [["viewer"]] : rows(query),
    }));
    await expect(manageSupplier(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => query.text.startsWith("insert"))).toBe(false);
  });
  it("enforces read/manage permissions before any query", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const work of [getSuppliersWorkspace, () => getSupplier(id), () => manageSupplier(command)]) {
      await expect(work()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("reads tenant-bound suppliers and permission without returning tenant identifiers", async () => {
    const saved = [id, "Helmand Grain", null, null, null, null, null, false];
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
      query.text.includes('from "suppliers"') ? [saved] : rows(query),
    }));
    const workspace = await getSuppliersWorkspace();
    expect(workspace.canManage).toBe(true);
    expect(workspace.suppliers[0]).toMatchObject({ id, name: "Helmand Grain", isActive: false });
    expect(workspace.suppliers[0]).not.toHaveProperty("organizationId");
    expect(await getSupplier(id)).toEqual(workspace.suppliers[0]);
    for (const [query, values] of mocks.query.mock.calls.filter(([query]) => query.text.includes('from "suppliers"'))) {
      expect(query.text).toContain('"suppliers"."organization_id" ='); expect(values).toContain(organizationId);
    }
  });
  it("returns not found for malformed, missing, or foreign supplier IDs", async () => {
    await expect(getSupplier("bad")).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query).not.toHaveBeenCalled();
    await expect(getSupplier(id)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes read failures", async () => {
    mocks.query.mockRejectedValue(new Error("private SQL password"));
    await expect(getSuppliersWorkspace()).rejects.toThrow(/^Suppliers unavailable\.$/);
    await expect(getSupplier(id)).rejects.toThrow(/^Suppliers unavailable\.$/);
  });
});
