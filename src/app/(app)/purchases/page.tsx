import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getPurchasesWorkspace } from "@/db/purchases";
import { PurchaseNumber } from "./_components/purchase-number";

export const metadata: Metadata = {
  title: "Purchases",
};

export default async function PurchasesPage() {
  const { purchases, canManage } = await getPurchasesWorkspace();
  return <div className="space-y-7">
    <PageHeader title={<T>Purchases</T>} description={<T>Agreed goods, quantities, and prices for your suppliers.</T>}
      action={canManage && <Button asChild><Link href="/purchases/new"><Plus aria-hidden="true" /><T>Create purchase draft</T></Link></Button>} />
    {!canManage && <p className="text-sm leading-6 text-ink-muted"><T>Only owners, admins, and managers can create purchase drafts.</T></p>}
    <Panel className="overflow-hidden p-0 shadow-none sm:p-0" aria-labelledby="purchase-register">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
        <h2 id="purchase-register" className="font-semibold"><T>Purchase register</T></h2>
        <span className="text-sm tabular-nums text-ink-muted"><T>Total:</T> {purchases.length}</span>
      </div>
      {purchases.length === 0 ? <div className="space-y-2 px-5 py-10 sm:px-6"><p className="font-semibold"><T>No purchases yet.</T></p>
        <p className="max-w-lg text-sm leading-6 text-ink-muted"><T>Save the goods and prices agreed with a supplier. A draft leaves stock and supplier balances unchanged.</T></p>
      </div> : <ul className="divide-y divide-border/60">{purchases.map((purchase) => <li key={purchase.id} className="grid min-w-0 gap-3 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-6">
        <div className="min-w-0"><Link href={`/purchases/${purchase.id}`} className="inline-flex min-h-11 max-w-full items-center break-words font-semibold hover:text-primary hover:underline"><bdi dir="auto">{purchase.supplierName}</bdi></Link>
          <p className="break-words text-sm text-ink-muted"><bdi dir="auto">{purchase.warehouseName}</bdi> · <time dateTime={purchase.createdAt.toISOString()}>{purchase.createdAt.toISOString().slice(0, 10)}</time></p></div>
        <div className="min-w-0 space-y-2 sm:text-end"><p className="font-semibold"><PurchaseNumber value={purchase.total} currency={purchase.currency} /></p>
          <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium"><T>Draft</T></span></div>
      </li>)}</ul>}
    </Panel>
  </div>;
}
