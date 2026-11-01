import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { getWarehouseWorkspace } from "@/db/warehouses";
import { PageHeader, Panel, StatusBadge } from "@/components/workspace";
import { WarehouseForm } from "./_components/warehouse-form";

export const metadata: Metadata = { title: "Warehouse" };

export default async function WarehousePage() {
  const { organizationId, warehouse, canManage } = await getWarehouseWorkspace();
  return <div className="max-w-3xl space-y-8">
    <div className="space-y-3">
      <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-primary"><ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" /><T>Settings</T></Link>
      <PageHeader title={<T>Warehouse</T>} description={<T>The stock location for your purchases and receipts. Each business uses one warehouse.</T>} />
      {!canManage && <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink-muted"><T>Only owners and admins can change warehouse settings.</T></p>}
    </div>
    <Panel className="space-y-6">
      {warehouse ? <div className="space-y-3 border-b border-border/70 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold" dir="auto">{warehouse.name}</h2><StatusBadge active={warehouse.isActive} /></div>
        <p className="break-words text-sm text-ink-muted" dir="auto">{warehouse.location ?? <T>Not specified</T>}</p>
        {!warehouse.isActive && <p className="text-sm leading-6 text-ink-muted"><T>This warehouse is unavailable for new purchases and receipts. An owner or admin can reactivate it.</T></p>}
      </div> : <div className="space-y-2"><h2 className="text-lg font-semibold"><T>No warehouse set up yet.</T></h2>
        <p className="text-sm leading-6 text-ink-muted"><T>An owner or admin needs to name the warehouse before purchases and receipts can use it.</T></p></div>}
      {canManage && <WarehouseForm key={organizationId} warehouse={warehouse} />}
    </Panel>
  </div>;
}
