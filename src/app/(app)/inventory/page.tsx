import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ExactNumber, trimDecimal } from "@/components/exact-number";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getInventoryWorkspace } from "@/db/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

function historyLink(productId?: string, after?: string) {
  const query = new URLSearchParams();
  if (productId) query.set("productId", productId);
  if (after) query.set("after", after);
  return `/inventory${query.size ? `?${query}` : ""}#stock-history`;
}

export default async function InventoryPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const query = await searchParams;
  const { balances, movements, product, after, nextCursor, canReadPurchases } = await getInventoryWorkspace({ productId: query?.productId, after: query?.after });
  return <div className="space-y-7">
    <PageHeader title={<T>Inventory</T>} description={<T>Recorded stock from accepted deliveries, in kilograms.</T>}
      action={canReadPurchases && <Button asChild variant="outline"><Link href="/purchases"><T>Open purchases</T></Link></Button>} />
    <p className="max-w-3xl text-sm leading-6 text-ink-muted"><T>Outgoing stock is not yet recorded. Reconcile these figures with a physical count.</T></p>
    {product && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="min-w-0 break-words font-medium"><T>Product:</T> <bdi dir="auto">{product.name}</bdi></p>
      <Button asChild variant="outline"><Link href="/inventory"><T>All products</T></Link></Button>
    </div>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <Panel className="min-w-0 overflow-hidden p-0 shadow-none sm:p-0" aria-labelledby="recorded-stock">
        <div className="border-b border-border/70 px-5 py-5 sm:px-6"><h2 id="recorded-stock" className="font-semibold"><T>Recorded stock</T></h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted"><T>Choose a product to view its history.</T></p></div>
        {balances.length === 0 ? <div className="space-y-2 px-5 py-7 sm:px-6"><p className="font-medium"><T>No recorded stock yet.</T></p>
          <p className="text-sm leading-6 text-ink-muted"><T>Stock appears when a delivery is accepted against a purchase.</T></p>
          <Button asChild variant="outline" className="mt-3"><Link href={canReadPurchases ? "/purchases" : "/products"}>{canReadPurchases ? <T>Open purchases</T> : <T>Open products</T>}</Link></Button>
        </div> : <ul className="divide-y divide-border/60">{balances.map((balance) => <li key={`${balance.productId}:${balance.warehouseId}`} className="grid min-w-0 items-start gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:px-6">
          <div className="min-w-0 [overflow-wrap:anywhere]"><Link href={historyLink(balance.productId)} className="inline-flex min-h-11 max-w-full items-center font-medium hover:text-primary hover:underline"><bdi dir="auto" className="min-w-0">{balance.productName}</bdi></Link>
            <p className="text-sm leading-6 text-ink-muted"><bdi dir="auto">{balance.warehouseName}</bdi></p>
            {(!balance.productActive || !balance.warehouseActive) && <p className="mt-1 text-xs leading-5 text-ink-muted">{!balance.productActive && <span className="block"><T>Inactive product</T></span>}{!balance.warehouseActive && <span className="block"><T>Inactive warehouse</T></span>}</p>}
          </div>
          <p className="min-w-0 text-end text-base font-medium sm:max-w-40 sm:pt-3"><ExactNumber value={balance.quantityKg} /> <span className="text-sm font-normal text-ink-muted">kg</span></p>
        </li>)}</ul>}
      </Panel>
      <Panel id="stock-history" className="min-w-0 scroll-mt-24 overflow-hidden p-0 shadow-none sm:p-0" aria-labelledby="stock-history-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-5 sm:px-6"><div><h2 id="stock-history-title" className="font-semibold"><T>Stock history</T></h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted"><T>Newest first. Times are shown in UTC.</T></p></div>
          <p className="text-sm tabular-nums text-ink-muted"><T>Shown:</T> {movements.length}</p></div>
        {movements.length === 0 ? <p className="px-5 py-7 text-sm leading-6 text-ink-muted sm:px-6">{after ? <T>No older movements.</T> : <T>No stock movements yet.</T>}</p>
          : <ol className="divide-y divide-border/60">{movements.map((movement) => <li key={movement.id} className="min-w-0 space-y-2 px-5 py-5 sm:px-6">
            <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]"><div className="min-w-0 [overflow-wrap:anywhere]"><p className="font-medium"><bdi dir="auto">{movement.productName}</bdi></p>
              <p className="mt-1 text-sm leading-6 text-ink-muted"><bdi dir="auto">{movement.warehouseName}</bdi></p></div>
              <p className="min-w-0 text-end font-medium sm:max-w-40"><ExactNumber value={`+${movement.quantityKg}`} /> <span className="text-sm font-normal text-ink-muted">kg</span></p></div>
            <p className="text-sm leading-6 text-ink-muted"><T>Received:</T> <ExactNumber value={trimDecimal(movement.quantity)} /> <bdi dir="auto">{movement.quantityUnitName}</bdi> · <ExactNumber value={movement.quantityMeasureKg} /> <T>kg each</T></p>
            <p className="text-xs leading-5 text-ink-muted"><time dateTime={movement.createdAt.toISOString()}><bdi dir="ltr">{movement.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC</bdi></time></p>
            <div className="min-w-0 text-sm"><p className="text-xs leading-5 text-ink-muted"><T>Receipt reference</T></p>
              {movement.purchaseId ? <Link href={`/purchases/${movement.purchaseId}`} className="inline-flex min-h-11 max-w-full items-center text-primary hover:underline"><bdi dir="ltr" className="[overflow-wrap:anywhere]">{movement.receiptId}</bdi></Link>
                : <p className="mt-1 [overflow-wrap:anywhere]"><bdi dir="ltr">{movement.receiptId}</bdi></p>}</div>
          </li>)}</ol>}
        {(after || nextCursor) && <nav aria-labelledby="stock-history-title" className="flex flex-wrap gap-3 border-t border-border/70 px-5 py-4 sm:px-6">
          {after && <Button asChild variant="outline"><Link href={historyLink(product?.id)}><T>Latest movements</T></Link></Button>}
          {nextCursor && <Button asChild variant="outline"><Link href={historyLink(product?.id, nextCursor)}><T>Older movements</T></Link></Button>}
        </nav>}
      </Panel>
    </div>
  </div>;
}
