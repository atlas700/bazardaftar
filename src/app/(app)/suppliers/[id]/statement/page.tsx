import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { ExactNumber } from "@/components/exact-number";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getSupplierAccount } from "@/db/supplier-statements";

export const metadata: Metadata = { title: "Supplier statement" };
type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function StatementPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams ?? {};
  const data = await getSupplierAccount({ supplierId: id, currency: query.currency, after: query.after });
  const base = `/suppliers/${data.supplier.id}/statement`;
  const paymentScope = new URLSearchParams({ supplierId: data.supplier.id, currency: data.currency }).toString();
  const balance = data.balances.find((row) => row.currency === data.currency);
  return <div className="space-y-7">
    <Link href={`/suppliers/${data.supplier.id}`} className="inline-flex min-h-11 items-center text-sm text-primary underline"><T>Supplier details</T></Link>
    <PageHeader title={<T>Supplier statement</T>} description={<bdi dir="auto" className="[overflow-wrap:anywhere]">{data.supplier.name}</bdi>}
      action={data.canRecord && balance?.outstanding !== "0.00" ? <Button asChild><Link href={`/payments/new?${paymentScope}`}><T>Record supplier payment</T></Link></Button> : undefined} />
    <Panel aria-labelledby="account-balances" className="space-y-5">
      <h2 id="account-balances" className="text-base font-semibold"><T>Account balances</T></h2>
      <div className="grid gap-6 sm:grid-cols-2">
        {data.balances.map((row) => <div key={row.currency} className="min-w-0 space-y-4">
          <div><p className="text-sm text-ink-muted"><T>Outstanding debt</T> · <bdi dir="ltr">{row.currency}</bdi></p>
            <p className="mt-1 text-2xl font-semibold"><ExactNumber value={row.outstanding} currency={row.currency} /></p></div>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-muted"><T>Receipt debt</T></dt><dd><ExactNumber value={row.debt} currency={row.currency} /></dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-muted"><T>Cash allocated</T></dt><dd><ExactNumber value={row.allocated} currency={row.currency} /></dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-muted"><T>Owner reductions (not cash)</T></dt><dd><ExactNumber value={row.reductions} currency={row.currency} /></dd></div>
          </dl>
        </div>)}
      </div>
      {!data.supplier.isActive && <p className="border-t border-border/70 pt-4 text-sm leading-6 text-ink-muted"><T>Inactive supplier. Recorded debt and settlements remain available.</T></p>}
      {data.supplier.paymentTerms && <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted [overflow-wrap:anywhere]"><T>Payment terms:</T> <bdi dir="auto">{data.supplier.paymentTerms}</bdi></p>}
    </Panel>
    <Panel aria-labelledby="statement-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="statement-heading" className="text-base font-semibold"><T>Account postings</T> · <bdi dir="ltr">{data.currency}</bdi></h2>
        <nav aria-labelledby="statement-currency" className="flex flex-wrap gap-2"><span id="statement-currency" className="sr-only"><T>Statement currency</T></span>{data.balances.map((row) => <Button key={row.currency} asChild variant={row.currency === data.currency ? "secondary" : "outline"}>
          <Link href={`${base}?currency=${row.currency}`} aria-current={row.currency === data.currency ? "page" : undefined}><bdi dir="ltr">{row.currency}</bdi></Link>
        </Button>)}</nav>
      </div>
      <p className="text-sm leading-6 text-ink-muted"><T>Posting order, newest first. Balances include all earlier postings in this currency. Payment dates are shown separately.</T></p>
      {!data.entries.length ? <p className="text-sm leading-6 text-ink-muted"><T>No account postings in this currency. Accepted receipts and supplier settlements will appear here.</T></p> :
        <ol className="divide-y divide-border/70">{data.entries.map((entry) => <li key={`${entry.kind}:${entry.id}`} className="space-y-3 py-5 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="font-medium">{entry.kind === "receipt" ? <T>Receipt debt</T> : entry.kind === "payment" ? <T>Cash payment</T> : <T>Owner-approved reduction (not cash)</T>}</h3>
              <p className="text-xs leading-5 text-ink-muted [overflow-wrap:anywhere]"><T>Posted (UTC):</T> <time dateTime={entry.postedAt} dir="ltr">{entry.postedAt}</time></p>
            </div>
            <div className="min-w-0 text-end">
              <p className="font-semibold"><ExactNumber value={`${entry.kind === "receipt" ? "+" : "−"}${entry.amount}`} currency={data.currency} /></p>
              <p className="mt-1 text-xs leading-5 text-ink-muted"><T>Balance after posting:</T> <ExactNumber value={entry.runningBalance} currency={data.currency} /></p>
            </div>
          </div>
          {entry.kind === "payment" && <>
            <p className="text-sm leading-6 text-ink-muted"><T>Payment date:</T> <time dateTime={entry.paidOn ?? undefined} dir="ltr">{entry.paidOn}</time> · <T>Cash paid:</T> <bdi dir="ltr">{entry.afnCash} AFN + {entry.pkrCash} PKR</bdi>
              {entry.pkrPerAfn && <> · <T>Agreed rate:</T> <bdi dir="ltr">1 AFN = {entry.pkrPerAfn} PKR</bdi></>}</p>
            {(entry.reference || entry.note) && <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]"><bdi dir="auto">{entry.reference}{entry.reference && entry.note ? " — " : ""}{entry.note}</bdi></p>}
            <details className="text-sm"><summary className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-2 focus-visible:outline-offset-4"><T>Receipt allocations</T></summary>
              <ul className="space-y-2 pt-2">{data.allocations.filter((allocation) => allocation.paymentId === entry.id).map((allocation) => <li key={allocation.payableId} className="flex flex-wrap items-center justify-between gap-2">
                <Link className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={`/purchases/${allocation.purchaseId}#receipt-${allocation.receiptId}`}><T>Accepted receipt</T> · <bdi dir="ltr">{allocation.receiptId.slice(0, 8)}</bdi></Link>
                <ExactNumber value={allocation.amount} currency={data.currency} />
              </li>)}</ul>
            </details>
          </>}
          {entry.kind === "reduction" && <div className="space-y-1 text-sm leading-6 [overflow-wrap:anywhere]">
            <p><bdi dir="auto">{entry.reason}</bdi></p><p className="text-ink-muted"><T>Approved by:</T> <bdi dir="auto">{entry.approvedByUserId}</bdi></p>
          </div>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {entry.receiptId && <Link className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={`/purchases/${entry.purchaseId}#receipt-${entry.receiptId}`}><T>Accepted receipt</T> · <bdi dir="ltr">{entry.receiptId.slice(0, 8)}</bdi></Link>}
            {entry.paymentId && <Link className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={`/payments?${paymentScope}&paymentId=${entry.paymentId}#payment-${entry.paymentId}`}><T>Supplier payment</T> · <bdi dir="ltr">{entry.paymentId.slice(0, 8)}</bdi></Link>}
          </div>
        </li>)}</ol>}
      {(data.after || data.nextCursor) && <nav aria-labelledby="statement-heading" className="flex flex-wrap gap-3">
        {data.after && <Button asChild variant="outline"><Link href={`${base}?currency=${data.currency}`}><T>Latest entries</T></Link></Button>}
        {data.nextCursor && <Button asChild variant="outline"><Link href={`${base}?${new URLSearchParams({ currency: data.currency, after: data.nextCursor })}`}><T>Older entries</T></Link></Button>}
      </nav>}
    </Panel>
  </div>;
}
