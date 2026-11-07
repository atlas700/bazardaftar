import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel, StatusBadge } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { getSupplier, getSuppliersWorkspace } from "@/db/suppliers";
import { SupplierForm } from "../_components/supplier-form";
import { SupplierType } from "../_components/supplier-type";

export const metadata: Metadata = { title: "Supplier details" };

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [supplier, { canManage, canReadBalances }] = await Promise.all([getSupplier(id), getSuppliersWorkspace()]);
  return <div className="max-w-4xl space-y-7">
    <Link href="/suppliers" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-primary"><ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" /><T>Suppliers</T></Link>
    <PageHeader title={<bdi dir="auto" className="break-words">{supplier.name}</bdi>} action={<StatusBadge active={supplier.isActive} />} />
    {canReadBalances && <Button asChild variant="outline"><Link href={`/suppliers/${supplier.id}/statement`}><T>Balances and statement</T></Link></Button>}
    <Panel className="shadow-none" aria-labelledby="supplier-details">
      <h2 id="supplier-details" className="mb-6 font-semibold"><T>Supplier details</T></h2>
      <dl className="grid gap-6 break-words sm:grid-cols-2">
        <div><dt className="text-xs font-medium text-ink-muted"><T>Phone</T></dt><dd className="mt-2 text-sm" dir="auto">{supplier.phone ?? <T>Not specified</T>}</dd></div>
        <div><dt className="text-xs font-medium text-ink-muted"><T>Location</T></dt><dd className="mt-2 text-sm" dir="auto">{supplier.location ?? <T>Not specified</T>}</dd></div>
        <div><dt className="text-xs font-medium text-ink-muted"><T>Supplier type</T></dt><dd className="mt-2 text-sm"><SupplierType type={supplier.type} /></dd></div>
        <div><dt className="text-xs font-medium text-ink-muted"><T>Payment terms</T></dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6" dir="auto">{supplier.paymentTerms ?? <T>Not specified</T>}</dd></div>
        <div className="border-t border-border/70 pt-5 sm:col-span-2"><dt className="text-xs font-medium text-ink-muted"><T>Notes</T></dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6" dir="auto">{supplier.notes ?? <T>Not specified</T>}</dd></div>
      </dl>
    </Panel>
    {!supplier.isActive && <p className="rounded-xl bg-muted p-4 text-sm leading-6 text-ink-muted"><T>This supplier is inactive. Its record is retained and cannot be edited.</T></p>}
    {canManage && supplier.isActive && <Panel aria-labelledby="edit-supplier" className="space-y-6 shadow-none">
      <div><h2 id="edit-supplier" className="text-lg font-semibold"><T>Edit supplier</T></h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted"><T>Keep contact details and agreements current. Deactivation keeps the supplier record.</T></p></div>
      <SupplierForm key={JSON.stringify(supplier)} supplier={supplier} />
    </Panel>}
  </div>;
}
