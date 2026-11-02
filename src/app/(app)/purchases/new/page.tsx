import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/workspace";
import { requirePermission } from "@/db/authorization";
import { getPurchasesWorkspace } from "@/db/purchases";
import { PurchaseForm } from "../_components/purchase-form";

export const metadata: Metadata = { title: "Create purchase draft" };
export default async function NewPurchasePage() {
  await requirePermission("purchases.manage");
  const workspace = await getPurchasesWorkspace();
  const ready = workspace.warehouse && workspace.suppliers.length > 0 && workspace.products.length > 0 && workspace.units.length > 0;
  return <div className="space-y-7">
    <Link href="/purchases" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-primary"><ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" /><T>Purchases</T></Link>
    <PageHeader title={<T>Create purchase draft</T>} description={<T>Record the supplier agreement before delivery.</T>} />
    {ready ? <Panel className="shadow-none"><PurchaseForm key={workspace.organizationId} workspace={workspace} requestId={randomUUID()} /></Panel> : <Panel className="space-y-4 shadow-none" aria-labelledby="purchase-setup">
      <h2 id="purchase-setup" className="font-semibold"><T>Finish purchase setup</T></h2>
      <p className="text-sm leading-6 text-ink-muted"><T>A draft needs an active supplier, a product with an active weight measure, and your active warehouse. Ask an owner or admin to help with unavailable setup.</T></p>
      <ul className="space-y-2 text-sm">
        {!workspace.warehouse && <li><Link className="inline-flex min-h-11 items-center text-primary hover:underline" href="/settings/warehouse"><T>Set up or reactivate your warehouse</T></Link></li>}
        {workspace.suppliers.length === 0 && <li><Link className="inline-flex min-h-11 items-center text-primary hover:underline" href="/suppliers"><T>Add an active supplier</T></Link></li>}
        {workspace.products.length === 0 && <li><Link className="inline-flex min-h-11 items-center text-primary hover:underline" href="/products"><T>Add a product with an active measure</T></Link></li>}
        {workspace.units.length === 0 && <li><Link className="inline-flex min-h-11 items-center text-primary hover:underline" href="/settings/catalog"><T>Set up weight measures</T></Link></li>}
      </ul>
    </Panel>}
  </div>;
}
