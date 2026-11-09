import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/nextjs/server";
import { test as base } from "@playwright/test";
import { Client } from "pg";
import { requireTestDatabaseUrl } from "../scripts/test-database.mjs";

type Pilot = { email: string; clerkOrganizationId: string; organizationId: string; supplierId: string; productId: string; client: Client };

export const test = base.extend<{ pilot: Pilot }>({
  pilot: async ({}, runScenario) => {
    const runId = randomUUID();
    const email = `bazardaftar+clerk_test_${runId}@example.com`;
    assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"), "Use a Clerk development instance.");
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const client = new Client({ connectionString: requireTestDatabaseUrl(process.env.AFCS_TEST_DATABASE_URL) });
    let userId: string | undefined, clerkOrganizationId: string | undefined, organizationId: string | undefined;
    await client.connect();
    try {
      assert.equal((await client.query("select current_database() as name")).rows[0].name, "afcs_task07_verify");
      const user = await clerk.users.createUser({ emailAddress: [email], skipPasswordRequirement: true, privateMetadata: { bazardaftarE2eRun: runId } });
      userId = user.id;
      const organization = await clerk.organizations.createOrganization({ name: `E2E ${runId}`, createdBy: userId, privateMetadata: { bazardaftarE2eRun: runId } });
      clerkOrganizationId = organization.id;
      const { data: memberships } = await clerk.organizations.getOrganizationMembershipList({ organizationId: organization.id, userId: [userId] });
      assert.equal(memberships.length, 1);
      organizationId = (await client.query("insert into organizations (clerk_organization_id) values ($1) returning id", [organization.id])).rows[0].id;
      await client.query("insert into organization_settings (organization_id,name,business_type,timezone,base_currency,locale) values ($1,$2,'wholesaler','Asia/Kabul','AFN','en-US')", [organizationId, organization.name]);
      await client.query("insert into organization_role_assignments (organization_id,membership_id,user_id,role) values ($1,$2,$3,'owner')", [organizationId, memberships[0].id, userId]);
      const unitId = (await client.query("insert into catalog_units (organization_id,name,kind,kilograms_per_unit) values ($1,'kg','fixed',1) returning id", [organizationId])).rows[0].id;
      const productId = (await client.query("insert into products (organization_id,name,unit_id) values ($1,'E2E Wheat',$2) returning id", [organizationId, unitId])).rows[0].id;
      const supplierId = (await client.query("insert into suppliers (organization_id,name) values ($1,'E2E Supplier') returning id", [organizationId])).rows[0].id;
      await client.query("insert into warehouses (organization_id,name) values ($1,'E2E Warehouse')", [organizationId]);
      assert.ok(organizationId);
      await runScenario({ email, clerkOrganizationId, organizationId, supplierId, productId, client });
    } finally {
      try {
        if (organizationId && clerkOrganizationId) {
          const remote = await clerk.organizations.getOrganization({ organizationId: clerkOrganizationId });
          assert.equal(remote.privateMetadata.bazardaftarE2eRun, runId);
          const local = await client.query("select clerk_organization_id from organizations where id=$1", [organizationId]);
          assert.equal(local.rows[0]?.clerk_organization_id, clerkOrganizationId);
          await client.query("begin");
          try {
            await client.query("alter table audit_logs disable trigger audit_logs_append_only");
            for (const table of ["audit_logs", "supplier_payment_reductions", "supplier_payment_allocations", "supplier_payments", "inventory_movements", "supplier_payables", "goods_receipt_items", "goods_receipts", "purchase_order_items", "purchase_orders", "products", "catalog_units", "suppliers", "warehouses", "organization_role_assignments", "organization_settings"]) {
              await client.query(`delete from ${table} where organization_id=$1`, [organizationId]);
            }
            await client.query("alter table audit_logs enable trigger audit_logs_append_only");
            await client.query("delete from organizations where id=$1", [organizationId]);
            await client.query("commit");
          } catch (error) { await client.query("rollback"); throw error; }
        }
        if (clerkOrganizationId) {
          const remote = await clerk.organizations.getOrganization({ organizationId: clerkOrganizationId });
          assert.equal(remote.privateMetadata.bazardaftarE2eRun, runId);
          await clerk.organizations.deleteOrganization(clerkOrganizationId);
        }
        if (userId) {
          const remote = await clerk.users.getUser(userId);
          assert.equal(remote.privateMetadata.bazardaftarE2eRun, runId);
          await clerk.users.deleteUser(userId);
          const key = createHmac("sha256", process.env.CLERK_SECRET_KEY!).update(JSON.stringify(["request-limits-v1", userId])).digest("hex");
          await client.query("delete from request_rate_limits where scope='mutation' and key=$1", [key]);
        }
      } finally { await client.end(); }
    }
  },
});

export { expect } from "@playwright/test";
