import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { and, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrders, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, warehouses } from "./schema";

type PurchaseCounts = { total: string; draft: string; awaiting: string; received: string; cancelled: string; receipts: string };
type Stock = { productId: string; warehouseId: string; productName: string; warehouseName: string; productActive: boolean; warehouseActive: boolean; quantityKg: string };
type Balance = { currency: "AFN" | "PKR"; outstanding: string };
export type DashboardTransaction = { id: string; postedAt: string; name: string; amount: string } & (
  | { kind: "purchase" | "receipt"; currency: "AFN" | "PKR"; purchaseId: string; supplierId: null; productId: null }
  | { kind: "payment" | "reduction"; currency: "AFN" | "PKR"; purchaseId: null; supplierId: string; productId: null }
  | { kind: "adjustment"; currency: null; purchaseId: null; supplierId: null; productId: string }
);

export async function getDashboard() {
  try {
    const tenant = await requirePermission("organization.read");
    return await db.transaction(async (tx) => {
      const [organization] = await tx.select({ clerkOrganizationId: organizations.clerkOrganizationId }).from(organizations)
        .where(eq(organizations.id, tenant.organizationId));
      const membership = await getActiveOrganizationMembership();
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId),
        eq(organizationRoleAssignments.userId, tenant.userId),
      ));
      if (!organization || !membership || membership.clerkOrganizationId !== organization.clerkOrganizationId ||
        membership.membershipId !== tenant.membershipId || membership.userId !== tenant.userId || !actor || !hasPermission(actor.role, "organization.read")) notFound();
      const capabilities = {
        purchases: hasPermission(actor.role, "purchases.read"), inventory: hasPermission(actor.role, "inventory.read"),
        balances: hasPermission(actor.role, "supplier_balances.read"), payments: hasPermission(actor.role, "supplier_payments.read"),
        createPurchase: hasPermission(actor.role, "purchases.manage"), recordPayment: hasPermission(actor.role, "supplier_payments.record"),
      };
      const org = tenant.organizationId;
      const purchases = capabilities.purchases ? (await tx.execute<PurchaseCounts>(sql`
        select count(*)::text as total, count(*) filter (where p.status = 'draft')::text as draft,
          count(*) filter (where p.status in ('ordered', 'partially_received'))::text as awaiting,
          count(*) filter (where p.status = 'received')::text as received,
          count(*) filter (where p.status = 'cancelled')::text as cancelled,
          (select count(*)::text from ${goodsReceipts} r where r.organization_id = ${org}) as receipts
        from ${purchaseOrders} p where p.organization_id = ${org}`)).rows[0] : null;
      const stock = capabilities.inventory ? (await tx.execute<Stock>(sql`
        select m.product_id as "productId", m.warehouse_id as "warehouseId", p.name as "productName", w.name as "warehouseName",
          p.is_active as "productActive", w.is_active as "warehouseActive", round(sum(m.quantity_kg), 3)::text as "quantityKg"
        from ${inventoryMovements} m
        inner join ${products} p on p.organization_id = m.organization_id and p.id = m.product_id
        inner join ${warehouses} w on w.organization_id = m.organization_id and w.id = m.warehouse_id
        where m.organization_id = ${org} group by m.product_id, p.name, p.is_active, m.warehouse_id, w.name, w.is_active
        order by p.name, m.product_id, m.warehouse_id limit 5`)).rows : null;
      // Union the ledger legs before aggregating: joining allocations and reductions would multiply debt.
      const balances = capabilities.balances ? (await tx.execute<Balance>(sql`
        with debt as (
          select currency, amount as change from ${supplierPayables} where organization_id = ${org}
          union all select currency, -amount from ${supplierPaymentAllocations} where organization_id = ${org}
          union all select currency, -amount from ${supplierPaymentReductions} where organization_id = ${org}
        ) select c.currency, round(coalesce(sum(d.change), 0), 2)::text as outstanding
        from (values ('AFN'), ('PKR')) c(currency) left join debt d on d.currency = c.currency
        group by c.currency order by c.currency`)).rows : null;
      const sources = [];
      if (capabilities.purchases) sources.push(sql`(select p.id, 'purchase'::text as kind, p.created_at as posted_at,
        p.supplier_name as name, p.total as amount, p.currency, p.id as purchase_id, null::uuid as supplier_id, null::uuid as product_id
        from ${purchaseOrders} p where p.organization_id = ${org} order by p.created_at desc, p.id desc limit 6)`,
      sql`(select r.id, 'receipt', r.accepted_at, p.supplier_name, r.total, r.currency, p.id, null::uuid, null::uuid
        from ${goodsReceipts} r inner join ${purchaseOrders} p on p.organization_id = r.organization_id and p.id = r.purchase_order_id
        where r.organization_id = ${org} order by r.accepted_at desc, r.id desc limit 6)`);
      if (capabilities.inventory) sources.push(sql`(select m.id, 'adjustment'::text as kind, m.created_at as posted_at,
        m.product_name as name, m.quantity_kg as amount, null::text as currency, null::uuid as purchase_id, null::uuid as supplier_id, m.product_id
        from ${inventoryMovements} m where m.organization_id = ${org} and m.kind = 'adjustment'
        order by m.created_at desc, m.id desc limit 6)`);
      if (capabilities.payments) sources.push(sql`(select p.id, 'payment', p.created_at, p.supplier_name, p.amount, p.currency, null::uuid, p.supplier_id, null::uuid
        from ${supplierPayments} p where p.organization_id = ${org} order by p.created_at desc, p.id desc limit 6)`);
      if (capabilities.balances) sources.push(sql`(select r.id, 'reduction', r.created_at, p.supplier_name, r.amount, r.currency, null::uuid, r.supplier_id, null::uuid
        from ${supplierPaymentReductions} r inner join ${supplierPayments} p on p.organization_id = r.organization_id and p.id = r.payment_id
        where r.organization_id = ${org} order by r.created_at desc, r.id desc limit 6)`);
      const transactions = sources.length ? (await tx.execute<DashboardTransaction>(sql`
        select id, kind, to_char(posted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "postedAt",
          name, (case when currency is null then round(amount, 3) else round(amount, 2) end)::text as amount,
          currency, purchase_id as "purchaseId", supplier_id as "supplierId", product_id as "productId"
        from (${sql.join(sources, sql` union all `)}) events order by posted_at desc, kind desc, id desc limit 6`)).rows : [];
      return { capabilities, purchases, stock, balances, transactions };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { throw safeServerError("Dashboard unavailable.", error); }
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
