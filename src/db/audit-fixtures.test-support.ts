import { inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { auditLogs, organizations } from "./schema";

// Privileged teardown is limited to explicitly tracked synthetic tenants in the disposable test DB.
export async function cleanupAuditFixtures(organizationIds: string[]): Promise<void> {
  if (!organizationIds.length) return;
  await db.transaction(async (tx) => {
    const result = await tx.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Audit cleanup requires the isolated verification database.");
    const rows = await tx.select().from(organizations).where(inArray(organizations.id, organizationIds));
    if (rows.length !== new Set(organizationIds).size || rows.some((row) => !/^task\d+_org_[0-9a-f-]{36}$/.test(row.clerkOrganizationId))) {
      throw new Error("Audit cleanup requires tracked synthetic tenants.");
    }
    // ALTER's exclusive lock keeps other sessions from writing while this transaction bypasses the guard.
    await tx.execute(sql`alter table audit_logs disable trigger audit_logs_append_only`);
    await tx.delete(auditLogs).where(inArray(auditLogs.organizationId, organizationIds));
    await tx.execute(sql`alter table audit_logs enable trigger audit_logs_append_only`);
  });
}
