import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/workspace";
import { getPurchase } from "@/db/purchases";
import { PurchaseNumber } from "../_components/purchase-number";

export const metadata: Metadata = { title: "Purchase draft" };
export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await getPurchase(id);
  return <div className="space-y-7">
    <Link href="/purchases" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-primary"><ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" /><T>Purchases</T></Link>
    <PageHeader title={<bdi dir="auto" className="break-words">{purchase.supplierName}</bdi>}
      description={<T>Purchase draft</T>} action={<span className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium"><T>Draft</T></span>} />
    <Panel className="shadow-none">
      <dl className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0"><dt className="text-sm text-ink-muted"><T>Warehouse</T></dt><dd className="mt-2 break-words font-medium"><bdi dir="auto">{purchase.warehouseName}</bdi></dd></div>
        <div><dt className="text-sm text-ink-muted"><T>Created (UTC)</T></dt><dd className="mt-2 text-sm"><time dateTime={purchase.createdAt.toISOString()}>{purchase.createdAt.toISOString().slice(0, 16).replace("T", " ")}</time></dd></div>
        <div className="min-w-0"><dt className="text-sm text-ink-muted"><T>Agreed total</T></dt><dd className="mt-2 text-2xl font-semibold"><PurchaseNumber value={purchase.total} currency={purchase.currency} /></dd></div>
      </dl>
    </Panel>
    <Panel className="overflow-hidden p-0 shadow-none sm:p-0" aria-labelledby="purchase-lines">
      <h2 id="purchase-lines" className="border-b border-border/70 px-5 py-5 font-semibold sm:px-6"><T>Purchase lines</T></h2>
      <ol className="divide-y divide-border/60">{purchase.items.map((item) => <li key={item.id} className="space-y-5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold"><bdi dir="auto">{item.productName}</bdi></h3>
          {item.productSku && <p className="mt-1 break-words text-sm text-ink-muted"><bdi dir="auto">{item.productSku}</bdi></p>}</div>
          <p className="max-w-full font-semibold"><PurchaseNumber value={item.lineTotal} currency={purchase.currency} /></p></div>
        <dl className="grid min-w-0 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0"><dt className="text-ink-muted"><T>Agreed quantity</T></dt><dd className="mt-2 break-words"><PurchaseNumber value={item.quantity.includes(".") ? item.quantity.replace(/0+$/, "").replace(/\.$/, "") : item.quantity} /> <bdi dir="auto">{item.quantityUnitName}</bdi></dd>
            <dd className="mt-1 text-ink-muted"><PurchaseNumber value={item.quantityMeasureKg} /> <T>kg per measure</T></dd></div>
          <div className="min-w-0"><dt className="text-ink-muted"><T>Total weight</T></dt><dd className="mt-2"><PurchaseNumber value={item.quantityKg} /> <T>kg</T></dd></div>
          <div className="min-w-0"><dt className="text-ink-muted"><T>Agreed unit price</T></dt><dd className="mt-2 break-words"><PurchaseNumber value={item.unitPrice} currency={purchase.currency} /> / <bdi dir="auto">{item.priceUnitName}</bdi></dd>
            <dd className="mt-1 text-ink-muted"><PurchaseNumber value={item.priceMeasureKg} /> <T>kg per price measure</T></dd></div>
        </dl>
      </li>)}</ol>
    </Panel>
    <p className="text-sm leading-6 text-ink-muted"><T>This draft records the agreement. Stock and supplier debt change when a delivery is accepted.</T></p>
  </div>;
}
