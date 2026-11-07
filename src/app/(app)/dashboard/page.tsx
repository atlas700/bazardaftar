import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ExactNumber } from "@/components/exact-number";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getDashboard, type DashboardTransaction } from "@/db/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function transactionLink(entry: DashboardTransaction) {
  if (entry.kind === "purchase" || entry.kind === "receipt") return `/purchases/${entry.purchaseId}${entry.kind === "receipt" ? `#receipt-${entry.id}` : ""}`;
  if (entry.kind === "adjustment") return `/inventory?${new URLSearchParams({ productId: entry.productId })}#stock-history`;
  return entry.kind === "payment" ? `/payments?${new URLSearchParams({ supplierId: entry.supplierId, currency: entry.currency, paymentId: entry.id })}`
    : `/suppliers/${entry.supplierId}/statement?${new URLSearchParams({ currency: entry.currency })}`;
}

export default async function DashboardPage() {
  const { capabilities, purchases, stock, balances, transactions } = await getDashboard();
  return <div className="space-y-6">
    <PageHeader title={<T>Overview</T>} description={<T>Purchases, recorded stock and supplier balances.</T>}
      action={capabilities.createPurchase ? <Button asChild><Link href="/purchases/new"><T>New purchase</T></Link></Button>
        : <Button asChild variant="outline"><Link href="/inventory"><T>Open inventory</T></Link></Button>} />
    {/* Two equal columns plus the shared gap fill the canvas; both stack below xl. */}
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Panel className="min-w-0 shadow-none" aria-labelledby="dashboard-purchases">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="dashboard-purchases" className="font-semibold"><T>Purchases & receipts</T></h2>
          {capabilities.purchases && <Button asChild variant="ghost"><Link href="/purchases"><T>All purchases</T></Link></Button>}</div>
        {purchases ? <>
          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
            <div><dt className="text-sm text-ink-muted"><T>Awaiting delivery</T></dt><dd className="mt-1 text-3xl font-medium"><ExactNumber value={purchases.awaiting} /></dd></div>
            <div><dt className="text-sm text-ink-muted"><T>Accepted receipts</T></dt><dd className="mt-1 text-3xl font-medium"><ExactNumber value={purchases.receipts} /></dd></div>
            <div><dt className="text-sm text-ink-muted"><T>Draft purchases</T></dt><dd className="mt-1 text-lg"><ExactNumber value={purchases.draft} /></dd></div>
            <div><dt className="text-sm text-ink-muted"><T>Received purchases</T></dt><dd className="mt-1 text-lg"><ExactNumber value={purchases.received} /></dd></div>
          </dl>
          <p className="mt-4 border-t border-border/70 pt-3 text-sm leading-6 text-ink-muted"><T>All purchases:</T> <ExactNumber value={purchases.total} /> · <T>Cancelled:</T> <ExactNumber value={purchases.cancelled} /></p>
          {purchases.total === "0" && <p className="mt-2 text-sm leading-6"><T>No purchases yet. Start with a purchase draft.</T></p>}
        </> : <p className="mt-3 text-sm leading-6 text-ink-muted"><T>Your role does not include purchase records.</T></p>}
      </Panel>
      <Panel className="min-w-0 shadow-none" aria-labelledby="dashboard-balances">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="dashboard-balances" className="font-semibold"><T>Outstanding supplier balances</T></h2>
          {capabilities.balances && <Button asChild variant="ghost"><Link href="/suppliers"><T>Supplier accounts</T></Link></Button>}</div>
        {balances ? <>
          <dl className="mt-3 space-y-4">{balances.map((balance) => <div key={balance.currency} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <dt className="text-sm text-ink-muted">{balance.currency}</dt><dd className="min-w-0 text-end text-2xl font-medium"><ExactNumber value={balance.outstanding} currency={balance.currency} /></dd>
          </div>)}</dl>
          <p className="mt-4 text-sm leading-6 text-ink-muted"><T>Accepted receipt payables less allocated payments and approved reductions. Currencies stay separate.</T></p>
          {capabilities.recordPayment && <Button asChild variant="outline" className="mt-3"><Link href="/payments/new"><T>Record supplier payment</T></Link></Button>}
        </> : <p className="mt-3 text-sm leading-6 text-ink-muted"><T>Your role does not include supplier balances.</T></p>}
      </Panel>
      <Panel className="min-w-0 shadow-none" aria-labelledby="dashboard-stock">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="dashboard-stock" className="font-semibold"><T>Recorded stock</T></h2>
          {capabilities.inventory && <Button asChild variant="ghost"><Link href="/inventory"><T>All stock & history</T></Link></Button>}</div>
        <p className="mt-1 text-sm leading-6 text-ink-muted"><T>Outgoing stock is not yet recorded. Reconcile these figures with a physical count.</T></p>
        {stock === null ? <p className="mt-4 text-sm text-ink-muted"><T>Your role does not include stock records.</T></p>
          : stock.length === 0 ? <p className="mt-4 text-sm leading-6"><T>No recorded stock yet. Accept a delivery or ask the owner to record opening stock.</T></p>
            : <><p className="mt-3 text-xs text-ink-muted"><T>First five product and warehouse balances, by product name.</T></p>
              <ul className="mt-2 divide-y divide-border/60">{stock.map((row) => <li key={`${row.productId}:${row.warehouseId}`} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
                <div className="min-w-0 [overflow-wrap:anywhere]"><Link href={`/inventory?${new URLSearchParams({ productId: row.productId })}`} className="inline-flex min-h-11 max-w-full items-center font-medium hover:text-primary hover:underline"><bdi dir="auto">{row.productName}</bdi></Link>
                  <p className="text-sm text-ink-muted"><bdi dir="auto">{row.warehouseName}</bdi></p>
                  {!row.productActive && <p className="text-xs leading-5 text-ink-muted"><T>Inactive product</T></p>}
                  {!row.warehouseActive && <p className="text-xs leading-5 text-ink-muted"><T>Inactive warehouse</T></p>}</div>
                <p className="min-w-0 text-end font-medium sm:max-w-48 sm:pt-3"><ExactNumber value={row.quantityKg} /> <span className="text-sm font-normal text-ink-muted">kg</span></p>
              </li>)}</ul></>}
      </Panel>
      <Panel className="min-w-0 shadow-none" aria-labelledby="dashboard-transactions">
        <h2 id="dashboard-transactions" className="font-semibold"><T>Recent transactions</T></h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted"><T>Latest six records you can access, by recording time. Payment amounts use the debt currency. Times are shown in UTC.</T></p>
        {transactions.length === 0 ? <p className="mt-4 text-sm leading-6"><T>No recent transactions. Recorded purchases, receipts, payments and stock adjustments appear here.</T></p>
          : <ol className="mt-3 divide-y divide-border/60">{transactions.map((entry) => <li key={`${entry.kind}:${entry.id}`} className="grid min-w-0 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]">
            <div className="min-w-0 [overflow-wrap:anywhere]"><Link href={transactionLink(entry)} className="inline-flex min-h-11 max-w-full items-center font-medium hover:text-primary hover:underline"><bdi dir="auto">{entry.name}</bdi></Link>
              <p className="text-sm text-ink-muted">{entry.kind === "purchase" ? <T>Purchase created</T> : entry.kind === "receipt" ? <T>Receipt accepted</T> : entry.kind === "payment" ? <T>Supplier payment</T> : entry.kind === "reduction" ? <T>Cash rounding reduction</T> : <T>Stock adjustment</T>}</p>
              <time dateTime={entry.postedAt} className="text-xs leading-5 text-ink-muted"><bdi dir="ltr">{entry.postedAt.replace("T", " ").slice(0, 19)} UTC</bdi></time></div>
            <p className="min-w-0 text-end font-medium sm:max-w-48 sm:pt-3"><ExactNumber value={entry.amount} currency={entry.currency ?? undefined} />{entry.kind === "adjustment" && <span className="text-sm font-normal text-ink-muted"> kg</span>}</p>
          </li>)}</ol>}
      </Panel>
    </div>
  </div>;
}
