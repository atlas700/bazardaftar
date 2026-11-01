import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge } from "@/components/workspace";
import { getSuppliersWorkspace } from "@/db/suppliers";
import { SupplierForm } from "./_components/supplier-form";
import { SupplierType } from "./_components/supplier-type";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { suppliers, canManage } = await getSuppliersWorkspace();
  return <div className="space-y-8">
    <PageHeader title={<T>Suppliers</T>} description={<T>The people and businesses you buy from.</T>}
      action={canManage && <Button asChild><a href="#add-supplier"><Plus aria-hidden="true" /><T>Add supplier</T></a></Button>} />
    {!canManage && <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink-muted"><T>Only owners, admins, and managers can change suppliers.</T></p>}
    <Panel aria-labelledby="supplier-directory" className="overflow-hidden p-0 shadow-none sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <h2 id="supplier-directory" className="font-semibold"><T>Supplier directory</T></h2>
        <span className="text-sm tabular-nums text-ink-muted"><T>Total:</T> {suppliers.length}</span>
      </div>
      {suppliers.length === 0 ? <div className="space-y-2 px-6 py-12">
        <p className="font-semibold"><T>No suppliers yet.</T></p>
        <p className="max-w-md text-sm leading-6 text-ink-muted"><T>Add your first supplier with a name. You can fill in contact details and payment terms whenever you have them.</T></p>
        {canManage && <a href="#add-supplier" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"><Plus className="size-4" aria-hidden="true" /><T>Add supplier</T></a>}
      </div> : <>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,0.6fr)_7rem_6rem] gap-5 px-6 py-3 text-xs font-medium text-ink-muted md:grid">
          <span><T>Supplier & location</T></span><span><T>Phone</T></span><span><T>Type</T></span><span><T>Status</T></span>
        </div>
        <ul className="divide-y divide-border/60">{suppliers.map((supplier) => <li key={supplier.id} className="grid min-w-0 gap-3 px-5 py-4 transition-colors hover:bg-page/60 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.6fr)_7rem_6rem] md:items-center md:gap-5">
          <div className="min-w-0">
            <Link href={`/suppliers/${supplier.id}`} className="inline-flex min-h-11 max-w-full items-center gap-2 break-words text-sm font-semibold hover:text-primary hover:underline"><bdi dir="auto" className="min-w-0">{supplier.name}</bdi><ArrowUpRight className="size-3.5 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" /></Link>
            <p className="break-words text-sm text-ink-muted"><span className="sr-only"><T>Location:</T> </span><bdi dir="auto">{supplier.location ?? <T>Not specified</T>}</bdi></p>
          </div>
          <p className="break-words text-sm text-ink-muted"><span className="me-2 md:sr-only"><T>Phone:</T></span><bdi dir="auto">{supplier.phone ?? <T>Not specified</T>}</bdi></p>
          <p className="text-sm text-ink-muted"><span className="me-2 md:sr-only"><T>Type:</T></span><SupplierType type={supplier.type} /></p>
          <StatusBadge active={supplier.isActive} />
        </li>)}</ul>
      </>}
    </Panel>
    {canManage && <Panel aria-labelledby="add-supplier" className="space-y-6 shadow-none">
      <div><h2 id="add-supplier" tabIndex={-1} className="text-lg font-semibold"><T>Add supplier</T></h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted"><T>Start with a name your team will recognize. All other details are optional.</T></p></div>
      <SupplierForm />
    </Panel>}
  </div>;
}
