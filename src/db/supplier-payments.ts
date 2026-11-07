import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { hasPermission, type Permission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal, parseNonNegativeDecimal } from "@/domain/decimal";
import { allocateCashPayment, currencySchema, validateRoundingReduction } from "@/domain/money";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import { goodsReceipts, organizationRoleAssignments, organizations, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers } from "./schema";
import type { TenantContext } from "./tenant";

export type PaymentState =
  | { status: "idle" | "conflict" | "insufficient_balance" }
  | { status: "success"; supplierId: string; currency: "AFN" | "PKR"; paymentId: string; reductionId?: string }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const wholeCash = z.string().max(18).regex(/^\d{1,18}$/).transform((value) => formatDecimal(parseNonNegativeDecimal(value, 0), 0));
const paymentSchema = z.object({
  requestId: localIdSchema, supplierId: localIdSchema, debtCurrency: currencySchema,
  paidOn: z.iso.date().refine((value) => value >= "0001-01-01", "Use a calendar year from 0001 to 9999."), afnCash: wholeCash, pkrCash: wholeCash,
  pkrPerAfn: z.string().max(25).optional().transform((value, ctx) => {
    if (!value) return undefined;
    try {
      const rate = parseNonNegativeDecimal(value, 6);
      if (rate === BigInt(0)) throw new RangeError();
      return formatDecimal(rate, 6);
    } catch { ctx.addIssue({ code: "custom", message: "Enter a positive PKR-per-AFN rate with at most six decimals." }); return z.NEVER; }
  }),
  reference: z.string().trim().max(100).default(""), note: z.string().trim().max(500).default(""),
}).transform((command, ctx) => {
  try { return { ...command, amount: allocateCashPayment(command) }; }
  catch { ctx.addIssue({ code: "custom", path: [command.pkrPerAfn === undefined && (command.debtCurrency === "AFN" ? command.pkrCash !== "0" : command.afnCash !== "0") ? "pkrPerAfn" : "afnCash"], message: "Check cash, conversion rate and supported payment value." }); return z.NEVER; }
});
const reductionSchema = z.object({
  requestId: localIdSchema, paymentId: localIdSchema, payableId: localIdSchema,
  amount: z.string().max(21).transform((value, ctx) => {
    try { return validateRoundingReduction({ previousReductions: "0", outstandingBalance: "0.99", reduction: value }); }
    catch { ctx.addIssue({ code: "custom", message: "Enter a reduction between 0.01 and 0.99." }); return z.NEVER; }
  }),
  reason: z.string().trim().min(1).max(500), approved: z.literal(true),
});
const workspaceSchema = z.object({ supplierId: localIdSchema.optional(), currency: currencySchema.default("AFN"), after: localIdSchema.optional(), paymentId: localIdSchema.optional() })
  .refine((value) => !(value.after && value.paymentId));
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recheckAuthority(tx: Transaction, tenant: TenantContext, permission: Permission, lock: boolean) {
  const query = tx.select().from(organizations).where(eq(organizations.id, tenant.organizationId));
  // Receipt, role, payment and reduction writers share this lock before rechecking authority.
  const [organization] = await (lock ? query.for("update") : query);
  const membership = await getActiveOrganizationMembership();
  const [actor] = await tx.select().from(organizationRoleAssignments).where(and(
    eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
  ));
  if (!organization || !membership || membership.clerkOrganizationId !== organization.clerkOrganizationId || membership.membershipId !== tenant.membershipId ||
    membership.userId !== tenant.userId || !actor || !hasPermission(actor.role, permission)) notFound();
  return actor;
}

const allocated = sql`coalesce((select sum(a.amount) from ${supplierPaymentAllocations} a
  where a.organization_id = ${supplierPayables.organizationId} and a.payable_id = ${supplierPayables.id}), 0)`;
const reduced = sql`coalesce((select sum(r.amount) from ${supplierPaymentReductions} r
  where r.organization_id = ${supplierPayables.organizationId} and r.payable_id = ${supplierPayables.id}), 0)`;
const remaining = sql`${supplierPayables.amount} - ${allocated} - ${reduced}`;

function openPayables(tx: Transaction, organizationId: string, supplierId: string, currency: "AFN" | "PKR", payableId?: string) {
  return tx.select({ id: supplierPayables.id, receiptId: supplierPayables.receiptId, purchaseId: goodsReceipts.purchaseOrderId,
    amount: supplierPayables.amount, outstanding: sql<string>`(${remaining})::text`, reductions: sql<string>`(${reduced})::text`,
    paymentId: sql<string | null>`(select p.id from ${supplierPayments} p inner join ${supplierPaymentAllocations} a
      on a.organization_id = p.organization_id and a.payment_id = p.id
      where a.organization_id = ${supplierPayables.organizationId} and a.payable_id = ${supplierPayables.id}
      order by p.created_at desc, p.id desc limit 1)`,
  }).from(supplierPayables).innerJoin(goodsReceipts, and(eq(goodsReceipts.organizationId, supplierPayables.organizationId), eq(goodsReceipts.id, supplierPayables.receiptId)))
    .where(and(eq(supplierPayables.organizationId, organizationId), eq(supplierPayables.supplierId, supplierId), eq(supplierPayables.currency, currency),
      payableId ? eq(supplierPayables.id, payableId) : undefined, sql`${remaining} > 0`))
    .orderBy(asc(supplierPayables.createdAt), asc(supplierPayables.id));
}

export async function recordSupplierPayment(input: unknown): Promise<PaymentState> {
  const tenant = await requirePermission("supplier_payments.record");
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "references"))] };
  const command = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<PaymentState> => {
    await recheckAuthority(tx, tenant, "supplier_payments.record", true);
    const [existing] = await tx.select().from(supplierPayments).where(and(eq(supplierPayments.organizationId, tenant.organizationId), eq(supplierPayments.requestId, command.requestId)));
    if (existing) return existing.requestFingerprint === fingerprint
      ? { status: "success", supplierId: existing.supplierId, currency: existing.currency, paymentId: existing.id } : { status: "conflict" };
    const [supplier] = await tx.select().from(suppliers).where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.id, command.supplierId)));
    if (!supplier) return { status: "invalid", fields: ["supplierId"] };
    // Deactivation prevents new purchases, but does not erase an existing settlement obligation.
    const payables = await openPayables(tx, tenant.organizationId, supplier.id, command.debtCurrency);
    let unallocated = parseNonNegativeDecimal(command.amount, 2);
    const allocations: { payableId: string; amount: string }[] = [];
    for (const payable of payables) {
      if (unallocated === BigInt(0)) break;
      const balance = parseNonNegativeDecimal(payable.outstanding, 2);
      const amount = balance < unallocated ? balance : unallocated;
      allocations.push({ payableId: payable.id, amount: formatDecimal(amount, 2) });
      unallocated -= amount;
    }
    if (unallocated > BigInt(0)) return { status: "insufficient_balance" };
    const [payment] = await tx.insert(supplierPayments).values({ organizationId: tenant.organizationId, requestId: command.requestId, requestFingerprint: fingerprint,
      supplierId: supplier.id, supplierName: supplier.name, currency: command.debtCurrency, paidOn: command.paidOn, afnCash: command.afnCash, pkrCash: command.pkrCash,
      pkrPerAfn: command.pkrPerAfn ?? null, amount: command.amount, reference: command.reference, note: command.note,
      recordedByUserId: tenant.userId, recordedByMembershipId: tenant.membershipId }).returning();
    // shortcut: one insert fits pilot histories; batch allocations inside this transaction before very large histories.
    await tx.insert(supplierPaymentAllocations).values(allocations.map((row) => ({ ...row, organizationId: tenant.organizationId, paymentId: payment.id, supplierId: supplier.id, currency: payment.currency })));
    await appendAudit(tx, tenant, { entityType: "supplier_payment", entityId: payment.id, action: "record", requestId: command.requestId,
      after: { ...payment, allocationCount: allocations.length } });
    return { status: "success", supplierId: supplier.id, currency: payment.currency, paymentId: payment.id };
  });
}

export async function reduceSupplierPayable(input: unknown): Promise<PaymentState> {
  const tenant = await requirePermission("supplier_payments.adjust_rounding");
  const parsed = reductionSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "references"))] };
  const command = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<PaymentState> => {
    await recheckAuthority(tx, tenant, "supplier_payments.adjust_rounding", true);
    const [existing] = await tx.select().from(supplierPaymentReductions).where(and(eq(supplierPaymentReductions.organizationId, tenant.organizationId), eq(supplierPaymentReductions.requestId, command.requestId)));
    if (existing) return existing.requestFingerprint === fingerprint
      ? { status: "success", supplierId: existing.supplierId, currency: existing.currency, paymentId: existing.paymentId, reductionId: existing.id } : { status: "conflict" };
    const [allocation] = await tx.select().from(supplierPaymentAllocations).where(and(eq(supplierPaymentAllocations.organizationId, tenant.organizationId),
      eq(supplierPaymentAllocations.paymentId, command.paymentId), eq(supplierPaymentAllocations.payableId, command.payableId)));
    if (!allocation) return { status: "invalid", fields: ["references"] };
    const [payable] = await openPayables(tx, tenant.organizationId, allocation.supplierId, allocation.currency, command.payableId);
    if (!payable) return { status: "invalid", fields: ["amount"] };
    try { validateRoundingReduction({ previousReductions: payable.reductions, reduction: command.amount, outstandingBalance: payable.outstanding }); }
    catch { return { status: "invalid", fields: ["amount"] }; }
    const [reduction] = await tx.insert(supplierPaymentReductions).values({ organizationId: tenant.organizationId, requestId: command.requestId, requestFingerprint: fingerprint,
      paymentId: allocation.paymentId, payableId: allocation.payableId, supplierId: allocation.supplierId, currency: allocation.currency, amount: command.amount, reason: command.reason,
      approvedByUserId: tenant.userId, approvedByMembershipId: tenant.membershipId }).returning();
    await appendAudit(tx, tenant, { entityType: "payment_reduction", entityId: reduction.id, action: "reduce", requestId: command.requestId, after: reduction });
    return { status: "success", supplierId: reduction.supplierId, currency: reduction.currency, paymentId: reduction.paymentId, reductionId: reduction.id };
  });
}

export async function getPaymentsWorkspace(input: unknown = {}) {
  try {
    const tenant = await requirePermission("supplier_payments.read");
    const parsed = workspaceSchema.safeParse(input);
    if (!parsed.success) notFound();
    const { supplierId, currency, after, paymentId } = parsed.data;
    return await db.transaction(async (tx) => {
      const actor = await recheckAuthority(tx, tenant, "supplier_payments.read", false);
      // shortcut: supplier options and open payables fit the pilot; paginate before large trading histories.
      const supplierRows = await tx.select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive }).from(suppliers)
        .where(eq(suppliers.organizationId, tenant.organizationId)).orderBy(asc(suppliers.name), asc(suppliers.id));
      const supplier = supplierRows.find((row) => row.id === supplierId) ?? null;
      if (supplierId && !supplier) notFound();
      const payables = supplier ? await openPayables(tx, tenant.organizationId, supplier.id, currency) : [];
      const total = payables.reduce((sum, row) => sum + parseNonNegativeDecimal(row.outstanding, 2), BigInt(0));
      // Aggregate debt can exceed the bound of one payable; retain all integer digits.
      const outstanding = `${total / BigInt(100)}.${(total % BigInt(100)).toString().padStart(2, "0")}`;
      const scope = and(eq(supplierPayments.organizationId, tenant.organizationId), eq(supplierPayments.currency, currency), supplierId ? eq(supplierPayments.supplierId, supplierId) : undefined);
      const [anchor] = after ? await tx.select({ createdAt: sql<string>`${supplierPayments.createdAt}::text` }).from(supplierPayments)
        .where(and(scope, eq(supplierPayments.id, after))).limit(1) : [];
      if (after && !anchor) notFound();
      const rows = await tx.select().from(supplierPayments).where(and(scope, paymentId ? eq(supplierPayments.id, paymentId) : undefined, anchor && after ? sql`(${supplierPayments.createdAt}, ${supplierPayments.id}) < (${anchor.createdAt}::timestamptz, ${after}::uuid)` : undefined))
        .orderBy(sql`${supplierPayments.createdAt} desc`, sql`${supplierPayments.id} desc`).limit(21);
      if (paymentId && !rows.length) notFound();
      const payments = rows.slice(0, 20);
      const ids = payments.map((row) => row.id);
      const allocations = ids.length ? await tx.select({ paymentId: supplierPaymentAllocations.paymentId, payableId: supplierPaymentAllocations.payableId,
        amount: supplierPaymentAllocations.amount, receiptId: supplierPayables.receiptId, purchaseId: goodsReceipts.purchaseOrderId })
        .from(supplierPaymentAllocations).innerJoin(supplierPayables, and(eq(supplierPayables.organizationId, supplierPaymentAllocations.organizationId), eq(supplierPayables.id, supplierPaymentAllocations.payableId)))
        .innerJoin(goodsReceipts, and(eq(goodsReceipts.organizationId, supplierPayables.organizationId), eq(goodsReceipts.id, supplierPayables.receiptId)))
        .where(and(eq(supplierPaymentAllocations.organizationId, tenant.organizationId), inArray(supplierPaymentAllocations.paymentId, ids)))
        .orderBy(asc(supplierPayables.createdAt), asc(supplierPayables.id)) : [];
      const reductions = ids.length ? await tx.select().from(supplierPaymentReductions)
        .where(and(eq(supplierPaymentReductions.organizationId, tenant.organizationId), inArray(supplierPaymentReductions.paymentId, ids)))
        .orderBy(asc(supplierPaymentReductions.createdAt), asc(supplierPaymentReductions.id)) : [];
      return { organizationId: tenant.organizationId, suppliers: supplierRows, supplier, currency, outstanding, payables, payments, allocations, reductions,
        canRecord: hasPermission(actor.role, "supplier_payments.record"), canReduce: hasPermission(actor.role, "supplier_payments.adjust_rounding"),
        after: after ?? null, paymentId: paymentId ?? null, nextCursor: rows.length > 20 ? payments[19].id : null };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { throw safeServerError("Supplier payments unavailable.", error); }
}

export type PaymentsWorkspace = Awaited<ReturnType<typeof getPaymentsWorkspace>>;
