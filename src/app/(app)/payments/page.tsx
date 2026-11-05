import type { Metadata } from "next";
import { T } from "gt-next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getPaymentsWorkspace } from "@/db/supplier-payments";
import { PaymentFilter } from "./_components/payment-filter";

export const metadata: Metadata = {
  title: "Payments",
};

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function PaymentsPage({ searchParams }: Props = {}) {
  const params = await searchParams ?? {};
  const data = await getPaymentsWorkspace({ supplierId: params.supplierId, currency: params.currency, after: params.after });
  const query = new URLSearchParams({ currency: data.currency });
  if (data.supplier) query.set("supplierId", data.supplier.id);
  const scope = query.toString();
  const eligible = data.payables.filter((payable) => payable.paymentId && payable.reductions !== "0.99");
  return <div className="space-y-7">
    <PageHeader title={<T>Supplier payments</T>} description={<T>Record cash paid to suppliers and trace its allocation to accepted receipts.</T>}
      action={data.canRecord && data.supplier && data.outstanding !== "0.00" ? <Button asChild><Link href={`/payments/new?${scope}`}><T>Record supplier payment</T></Link></Button> : undefined} />
    <Panel className="space-y-5">
      {data.suppliers.length ? <PaymentFilter key={`${data.organizationId}:${data.supplier?.id}:${data.currency}`} suppliers={data.suppliers} supplierId={data.supplier?.id} currency={data.currency} />
        : <p className="text-sm leading-6 text-ink-muted"><T>Add a supplier and accept a purchase receipt before recording a payment.</T> <Link href="/suppliers" className="inline-flex min-h-11 items-center text-primary underline"><T>Open suppliers</T></Link></p>}
      {data.supplier ? <div className="space-y-2 border-t border-border/70 pt-5">
        <p className="text-sm text-ink-muted"><T>Outstanding receipt debt</T> — <bdi dir="auto">{data.supplier.name}</bdi></p>
        <p className="text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]"><bdi dir="ltr">{data.outstanding} {data.currency}</bdi></p>
        {!data.supplier.isActive && <p className="text-sm leading-6 text-ink-muted"><T>This supplier is inactive. Existing receipt debt can still be settled.</T></p>}
        {data.outstanding === "0.00" && <p className="text-sm leading-6 text-ink-muted"><T>No outstanding debt in this currency. Supplier advances and overpayments are not accepted.</T></p>}
      </div> : <p className="text-sm leading-6 text-ink-muted"><T>Select a supplier and debt currency to check outstanding debt and record a payment.</T></p>}
    </Panel>
    <Panel className="space-y-5">
      <h2 id="payment-history-heading" className="text-base font-semibold"><T>Recorded payments</T> — <bdi dir="ltr">{data.currency}</bdi></h2>
      {!data.payments.length ? <p className="text-sm leading-6 text-ink-muted"><T>No supplier payments match this view.</T></p> : <ul className="divide-y divide-border/70">
        {data.payments.map((payment) => <li key={payment.id} id={`payment-${payment.id}`} className="space-y-3 py-5 first:pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
            <p className="font-medium"><bdi dir="auto">{payment.supplierName}</bdi></p>
            <p className="text-sm text-ink-muted"><T>Payment date:</T> <time dateTime={payment.paidOn} dir="ltr">{payment.paidOn}</time></p>
          </div><p className="font-semibold tabular-nums [overflow-wrap:anywhere]"><bdi dir="ltr">{payment.amount} {payment.currency}</bdi></p></div>
          <p className="text-sm leading-6 text-ink-muted"><T>Cash paid:</T> <bdi dir="ltr">{payment.afnCash} AFN + {payment.pkrCash} PKR</bdi>
            {payment.pkrPerAfn && <> · <T>Agreed rate:</T> <bdi dir="ltr">1 AFN = {payment.pkrPerAfn} PKR</bdi></>}</p>
          {(payment.reference || payment.note) && <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]"><bdi dir="auto">{payment.reference}{payment.reference && payment.note ? " — " : ""}{payment.note}</bdi></p>}
          <details className="text-sm"><summary className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-2 focus-visible:outline-offset-4"><T>Receipt allocations and owner reductions</T></summary>
            <ul className="space-y-2 pt-2">{data.allocations.filter((allocation) => allocation.paymentId === payment.id).map((allocation) => <li key={allocation.payableId} className="flex flex-wrap justify-between gap-2">
              <Link href={`/purchases/${allocation.purchaseId}#receipt-${allocation.receiptId}`} className="inline-flex min-h-11 items-center text-primary underline [overflow-wrap:anywhere]"><T>Accepted receipt</T> · <bdi dir="ltr">{allocation.receiptId.slice(0, 8)}</bdi></Link>
              <span className="content-center tabular-nums"><bdi dir="ltr">{allocation.amount} {payment.currency}</bdi></span>
            </li>)}</ul>
            {data.reductions.filter((reduction) => reduction.paymentId === payment.id).map((reduction) => <div key={reduction.id} className="mt-3 space-y-1 border-t border-border/70 pt-3 [overflow-wrap:anywhere]">
              <p><T>Owner-approved reduction (not cash):</T> <bdi dir="ltr" className="tabular-nums">{reduction.amount} {reduction.currency}</bdi></p>
              <p><T>Payable:</T> <bdi dir="ltr">{reduction.payableId.slice(0, 8)}</bdi> · <time dateTime={reduction.createdAt.toISOString()} dir="ltr">{reduction.createdAt.toISOString()}</time></p>
              <p><bdi dir="auto">{reduction.reason}</bdi></p>
              <p className="text-ink-muted"><T>Approved by:</T> <bdi dir="auto">{reduction.approvedByUserId}</bdi></p>
            </div>)}
          </details>
        </li>)}
      </ul>}
      {(data.after || data.nextCursor) && <nav aria-labelledby="payment-history-heading" className="flex flex-wrap gap-3">
        {data.after && <Button asChild variant="outline"><Link href={`/payments?${scope}`}><T>Latest payments</T></Link></Button>}
        {data.nextCursor && <Button asChild variant="outline"><Link href={`/payments?${scope}&after=${data.nextCursor}`}><T>Older payments</T></Link></Button>}
      </nav>}
    </Panel>
    {data.supplier && data.canReduce && <Panel className="space-y-4">
      <h2 className="text-base font-semibold"><T>Approve a rounding reduction</T></h2>
      <p className="text-sm leading-6 text-ink-muted"><T>A reduction is not a cash payment. Each paid receipt has a lifetime allowance of 0.99 in its debt currency. Larger differences stay outstanding.</T></p>
      <ul className="divide-y divide-border/70">{eligible.map((payable) => <li key={payable.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="text-sm [overflow-wrap:anywhere]"><T>Receipt</T> <bdi dir="ltr">{payable.receiptId.slice(0, 8)}</bdi> · <T>Outstanding:</T> <bdi dir="ltr" className="tabular-nums">{payable.outstanding} {data.currency}</bdi></span>
        <Button asChild variant="outline"><Link href={`/payments/rounding?${scope}&payableId=${payable.id}`}><T>Review reduction</T></Link></Button>
      </li>)}</ul>
      {!eligible.length && <p className="text-sm leading-6 text-ink-muted"><T>No paid receipt in this view has both outstanding debt and a remaining rounding allowance.</T></p>}
    </Panel>}
  </div>;
}
