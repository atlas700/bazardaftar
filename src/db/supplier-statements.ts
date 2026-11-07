import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { goodsReceipts, organizationRoleAssignments, organizations, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers } from "./schema";

const kindSchema = z.enum(["receipt", "payment", "reduction"]);
const cursorSchema = z.string().max(46).refine((value) => {
  const [kind, id, ...extra] = value.split(":");
  return !extra.length && kindSchema.safeParse(kind).success && localIdSchema.safeParse(id).success;
});
const querySchema = z.object({ supplierId: localIdSchema, currency: z.enum(["AFN", "PKR"]).default("AFN"), after: cursorSchema.optional() });

export type StatementEntry = {
  id: string; kind: z.infer<typeof kindSchema>; postedAt: string; amount: string; runningBalance: string;
  receiptId: string | null; purchaseId: string | null; paymentId: string | null;
  paidOn: string | null; afnCash: string | null; pkrCash: string | null; pkrPerAfn: string | null;
  reference: string | null; note: string | null; reason: string | null; approvedByUserId: string | null;
};
type Balance = { currency: "AFN" | "PKR"; debt: string; allocated: string; reductions: string; outstanding: string };

// One payment event contains its allocated value once, regardless of receipt count.
function accountEvents(organizationId: string, supplierId: string) {
  return sql`with events as (
    select p.id, 'receipt'::text as kind, 0 as kind_order, p.created_at as posted_at, p.currency, p.amount,
      p.amount as change, p.receipt_id, r.purchase_order_id as purchase_id, null::uuid as payment_id,
      null::text as paid_on, null::text as afn_cash, null::text as pkr_cash, null::text as pkr_per_afn,
      null::text as reference, null::text as note, null::text as reason, null::text as approved_by_user_id
    from ${supplierPayables} p inner join ${goodsReceipts} r on r.organization_id = p.organization_id and r.id = p.receipt_id
    where p.organization_id = ${organizationId} and p.supplier_id = ${supplierId}
    union all
    select p.id, 'payment', 1, p.created_at, p.currency, a.amount, -a.amount,
      null::uuid, null::uuid, p.id, p.paid_on::text, p.afn_cash::text, p.pkr_cash::text, p.pkr_per_afn::text,
      p.reference, p.note, null::text, null::text
    from ${supplierPayments} p cross join lateral (
      select coalesce(sum(a.amount), 0) as amount from ${supplierPaymentAllocations} a
      where a.organization_id = p.organization_id and a.payment_id = p.id and a.supplier_id = p.supplier_id and a.currency = p.currency
    ) a where p.organization_id = ${organizationId} and p.supplier_id = ${supplierId}
    union all
    select r.id, 'reduction', 2, r.created_at, r.currency, r.amount, -r.amount,
      p.receipt_id, g.purchase_order_id, r.payment_id, null::text, null::text, null::text, null::text,
      null::text, null::text, r.reason, r.approved_by_user_id
    from ${supplierPaymentReductions} r inner join ${supplierPayables} p
      on p.organization_id = r.organization_id and p.id = r.payable_id
      inner join ${goodsReceipts} g on g.organization_id = p.organization_id and g.id = p.receipt_id
    where r.organization_id = ${organizationId} and r.supplier_id = ${supplierId}
  )`;
}

export async function getSupplierAccount(input: unknown) {
  try {
    const tenant = await requirePermission("supplier_balances.read");
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) notFound();
    const { supplierId, currency, after } = parsed.data;
    return await db.transaction(async (tx) => {
      const [organization] = await tx.select({ clerkOrganizationId: organizations.clerkOrganizationId }).from(organizations)
        .where(eq(organizations.id, tenant.organizationId));
      const membership = await getActiveOrganizationMembership();
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId),
        eq(organizationRoleAssignments.userId, tenant.userId),
      ));
      if (!organization || !membership || membership.clerkOrganizationId !== organization.clerkOrganizationId ||
        membership.membershipId !== tenant.membershipId || membership.userId !== tenant.userId || !actor || !hasPermission(actor.role, "supplier_balances.read")) notFound();
      const [supplier] = await tx.select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive, paymentTerms: suppliers.paymentTerms }).from(suppliers)
        .where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.id, supplierId)));
      if (!supplier) notFound();
      const events = accountEvents(tenant.organizationId, supplierId);
      const [kind, cursorId] = after?.split(":") ?? [];
      const anchor = after ? (await tx.execute<{ postedAt: string; kindOrder: number; id: string }>(sql`${events}
        select posted_at::text as "postedAt", kind_order as "kindOrder", id from events
        where currency = ${currency} and kind = ${kind} and id = ${cursorId}::uuid`)).rows[0] : null;
      if (after && !anchor) notFound();
      const balances = (await tx.execute<Balance>(sql`${events}
        select c.currency,
          round(coalesce(sum(e.amount) filter (where e.kind = 'receipt'), 0), 2)::text as debt,
          round(coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0), 2)::text as allocated,
          round(coalesce(sum(e.amount) filter (where e.kind = 'reduction'), 0), 2)::text as reductions,
          round(coalesce(sum(e.change), 0), 2)::text as outstanding
        from (values ('AFN'), ('PKR')) c(currency) left join events e on e.currency = c.currency
        group by c.currency order by c.currency`)).rows;
      // Calculate the full account's running balances before applying the page boundary.
      const rows = (await tx.execute<StatementEntry>(sql`${events}, ledger as (
        select *, sum(change) over (order by posted_at, kind_order, id rows unbounded preceding) as balance
        from events where currency = ${currency}
      ) select id, kind, to_char(posted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "postedAt",
        round(amount, 2)::text as amount, round(balance, 2)::text as "runningBalance",
        receipt_id as "receiptId", purchase_id as "purchaseId", payment_id as "paymentId", paid_on as "paidOn",
        afn_cash as "afnCash", pkr_cash as "pkrCash", pkr_per_afn as "pkrPerAfn", reference, note, reason, approved_by_user_id as "approvedByUserId"
        from ledger ${anchor ? sql`where (posted_at, kind_order, id) < (${anchor.postedAt}::timestamptz, ${anchor.kindOrder}, ${anchor.id}::uuid)` : sql``}
        order by posted_at desc, kind_order desc, id desc limit 21`)).rows;
      const entries = rows.slice(0, 20);
      const paymentIds = entries.filter((entry) => entry.kind === "payment").map((entry) => entry.id);
      const allocations = paymentIds.length ? await tx.select({ paymentId: supplierPaymentAllocations.paymentId, payableId: supplierPaymentAllocations.payableId,
        amount: supplierPaymentAllocations.amount, receiptId: supplierPayables.receiptId, purchaseId: goodsReceipts.purchaseOrderId })
        .from(supplierPaymentAllocations).innerJoin(supplierPayables, and(eq(supplierPayables.organizationId, supplierPaymentAllocations.organizationId), eq(supplierPayables.id, supplierPaymentAllocations.payableId)))
        .innerJoin(goodsReceipts, and(eq(goodsReceipts.organizationId, supplierPayables.organizationId), eq(goodsReceipts.id, supplierPayables.receiptId)))
        .where(and(eq(supplierPaymentAllocations.organizationId, tenant.organizationId), eq(supplierPaymentAllocations.supplierId, supplierId),
          eq(supplierPaymentAllocations.currency, currency), inArray(supplierPaymentAllocations.paymentId, paymentIds)))
        .orderBy(supplierPaymentAllocations.paymentId, supplierPayables.createdAt, supplierPayables.id) : [];
      const last = entries.at(-1);
      return { supplier, currency, balances, entries, allocations, after: after ?? null,
        nextCursor: rows.length > 20 && last ? `${last.kind}:${last.id}` : null,
        canRecord: hasPermission(actor.role, "supplier_payments.record") };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { throw safeServerError("Supplier account unavailable.", error); }
}

export type SupplierAccount = Awaited<ReturnType<typeof getSupplierAccount>>;
