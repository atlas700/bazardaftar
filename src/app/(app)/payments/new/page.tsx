import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getPaymentsWorkspace } from "@/db/supplier-payments";
import { PaymentFilter } from "../_components/payment-filter";
import { SettlementForm } from "../_components/settlement-form";

export const metadata: Metadata = { title: "Record supplier payment" };
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function NewPaymentPage({ searchParams }: Props = {}) {
  const params = await searchParams ?? {};
  const data = await getPaymentsWorkspace({ supplierId: params.supplierId, currency: params.currency });
  if (!data.canRecord) notFound();
  const paidOn = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <div className="space-y-7">
    <PageHeader title={<T>Record supplier payment</T>} description={<T>Enter cash actually paid. Allocation to the supplier's oldest unpaid receipts is automatic.</T>}
      action={<Button asChild variant="outline"><Link href="/payments"><T>Back to supplier payments</T></Link></Button>} />
    <Panel className="max-w-3xl space-y-6">
      {!data.supplier ? <><p className="text-sm leading-6 text-ink-muted"><T>Select a supplier and debt currency before entering cash.</T></p>
        {data.suppliers.length ? <PaymentFilter key={data.organizationId} suppliers={data.suppliers} currency={data.currency} action="/payments/new" />
          : <Link href="/suppliers" className="inline-flex min-h-11 items-center text-primary underline"><T>Open suppliers</T></Link>}</>
        : <><div className="space-y-2 text-sm leading-6 [overflow-wrap:anywhere]"><p><T>Supplier:</T> <bdi dir="auto">{data.supplier.name}</bdi></p>
          <p><T>Outstanding receipt debt:</T> <bdi dir="ltr" className="font-semibold tabular-nums">{data.outstanding} {data.currency}</bdi></p></div>
          {data.outstanding === "0.00" ? <p className="text-sm leading-6 text-ink-muted"><T>This supplier has no outstanding debt in this currency. Overpayments and advances are not accepted.</T></p>
            : <SettlementForm key={`${data.organizationId}:${data.supplier.id}:${data.currency}`} kind="cash" requestId={randomUUID()} supplierId={data.supplier.id} currency={data.currency} paidOn={paidOn} />}
        </>}
    </Panel>
  </div>;
}
