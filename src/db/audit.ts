import "server-only";

import { randomUUID } from "node:crypto";
import type { db } from "./index";
import { auditLogs, type AuditSnapshot } from "./schema";
import type { TenantContext } from "./tenant";

type AuditRow = typeof auditLogs.$inferInsert;
type AuditEvent = Pick<AuditRow, "entityType" | "entityId" | "action"> & {
  requestId?: string;
  outcome?: "requested" | "completed";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};
const snapshotFields = {
  organization: ["baseCurrency", "locale", "timezone"],
  staff: ["membershipId", "userId", "role", "invitationId"],
  catalog_unit: ["name", "kind", "kilogramsPerUnit", "isActive"],
  product_category: ["name", "isActive"],
  product: ["name", "sku", "unitId", "categoryId", "isActive"],
  supplier: ["type", "isActive"],
  warehouse: ["name", "isActive"],
  purchase: ["supplierId", "warehouseId", "currency", "status", "revision", "total", "itemCount"],
  receipt: ["purchaseOrderId", "currency", "total", "completesPurchase", "varianceApproved", "itemCount"],
  supplier_payable: ["receiptId", "supplierId", "currency", "amount"],
  inventory_adjustment: ["productId", "warehouseId", "quantityKg", "reasonCode"],
  supplier_payment: ["supplierId", "currency", "afnCash", "pkrCash", "pkrPerAfn", "amount", "paymentDate", "allocationCount"],
  payment_reduction: ["paymentId", "payableId", "supplierId", "currency", "amount"],
} satisfies Record<AuditRow["entityType"], string[]>;
const changeFields = ["name", "businessType", "timezone", "baseCurrency", "locale", "sku", "unitId", "categoryId", "kind", "kilogramsPerUnit",
  "phone", "location", "type", "notes", "paymentTerms", "isActive"];

function snapshot(entityType: AuditRow["entityType"], source: AuditEvent["before"]): AuditSnapshot | null {
  if (!source) return null;
  const result: AuditSnapshot = {};
  for (const key of snapshotFields[entityType]) {
    const value = source[key];
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.length <= 200)) result[key] = value;
  }
  const changedFields = source.changedFields;
  if (Array.isArray(changedFields)) {
    result.changedFields = changeFields.filter((field) => changedFields.includes(field));
  }
  return result;
}

// Call only after authority rechecking; completed local events use the mutation's transaction.
export async function appendAudit(connection: Pick<typeof db, "insert">, actor: Pick<TenantContext, "organizationId" | "userId" | "membershipId">, event: AuditEvent): Promise<void> {
  await connection.insert(auditLogs).values({ organizationId: actor.organizationId, actorUserId: actor.userId, actorMembershipId: actor.membershipId,
    entityType: event.entityType, entityId: event.entityId, action: event.action, outcome: event.outcome ?? "completed", requestId: event.requestId ?? randomUUID(),
    before: snapshot(event.entityType, event.before), after: snapshot(event.entityType, event.after) });
}
