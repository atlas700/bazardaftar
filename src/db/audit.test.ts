import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client();
  client.query = mocks.query;
  return { db: drizzle({ client }) };
});

import { appendAudit } from "./audit";
import { db } from "./index";

const actor = { organizationId: "53409e5c-e4d7-4351-a6b3-46ee18c4f532", userId: "user_verified", membershipId: "member_verified" };
const entityId = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const requestId = "73409e5c-e4d7-4351-a6b3-46ee18c4f532";
beforeEach(() => mocks.query.mockResolvedValue({ rows: [] }));
afterEach(() => vi.resetAllMocks());

function inserted() {
  const [query, values] = mocks.query.mock.calls.find(([query]) => query?.text?.startsWith('insert into "audit_logs"'))!;
  return { query, values, snapshots: values.filter((value: unknown) => typeof value === "string" && value.startsWith("{")).map((value: string) => JSON.parse(value)) };
}

describe("transactional audit writer", () => {
  it("uses the supplied transaction and binds verified identity and correlation", async () => {
    await db.transaction((tx) => appendAudit(tx, actor, { entityType: "purchase", entityId, action: "order", requestId,
      before: { status: "draft", revision: 1 }, after: { status: "ordered", revision: 2, total: "9007199254740993.99" } }));
    const { query, values, snapshots } = inserted();
    expect(values).toEqual(expect.arrayContaining([actor.organizationId, actor.userId, actor.membershipId, "purchase", entityId, "order", requestId, "completed"]));
    expect(query.text).not.toContain(actor.userId);
    expect(snapshots).toEqual([{ status: "draft", revision: 1 }, { status: "ordered", revision: 2, total: "9007199254740993.99" }]);
    expect(mocks.query.mock.calls.map(([query]) => query.text.split(" ")[0])).toEqual(["begin", "insert", "commit"]);
  });

  it("allowlists snapshots and never stores contact details, credentials or nested payloads", async () => {
    const after = { type: "business", isActive: true, name: "Private Person", phone: "+93700123456", location: "Private address",
      notes: "Private note", paymentTerms: "Private terms", emailAddress: "private@example.test", password: "secret",
      session: { token: "secret" }, organizationId: "spoofed", changedFields: ["phone", "notes", "password", "session"] };
    await db.transaction((tx) => appendAudit(tx, actor, { entityType: "supplier", entityId, action: "update", after }));
    const { values, snapshots } = inserted();
    expect(snapshots).toEqual([{ type: "business", isActive: true, changedFields: ["phone", "notes"] }]);
    expect(JSON.stringify(values)).not.toMatch(/Private|93700123456|private@example|secret|spoofed|password|session/);
    expect(after.phone).toBe("+93700123456");
    expect(values.some((value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value) && value !== actor.organizationId && value !== entityId)).toBe(true);
  });

  it("keeps bounded operational fields and rejects unsafe snapshot values", async () => {
    await db.transaction((tx) => appendAudit(tx, actor, { entityType: "product", entityId, action: "update",
      before: { name: "Old Wheat", categoryId: null }, after: { name: "x".repeat(201), sku: { private: true }, unitId: entityId,
        isActive: true, changedFields: ["name", "sku", { token: "secret" }], revision: Infinity } }));
    expect(inserted().snapshots).toEqual([{ name: "Old Wheat", categoryId: null }, { unitId: entityId, isActive: true, changedFields: ["name", "sku"] }]);
  });

  it("retains provider requests distinctly from completed changes", async () => {
    await appendAudit(db, actor, { entityType: "staff", entityId: actor.organizationId, action: "invite", outcome: "requested", requestId,
      after: { emailAddress: "private@example.test", role: "org:member" } });
    expect(inserted().values).toEqual(expect.arrayContaining(["requested", requestId]));
    expect(inserted().snapshots).toEqual([{ role: "org:member" }]);
    expect(mocks.query.mock.calls.filter(([query]) => query?.text).map(([query]) => query.text.split(" ")[0])).toEqual(["insert"]);
  });

  it("propagates an audit failure so its business transaction rolls back", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => {
      if (query.text.startsWith('insert into "audit_logs"')) throw new Error("audit storage failed");
      return { rows: [] };
    });
    await expect(db.transaction((tx) => appendAudit(tx, actor, { entityType: "receipt", entityId, action: "accept", after: { total: "100.00" } }))).rejects.toThrow();
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ text: "rollback" }), []);
  });
});
