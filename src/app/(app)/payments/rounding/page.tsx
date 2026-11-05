import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getPaymentsWorkspace } from "@/db/supplier-payments";
import { formatDecimal, parseNonNegativeDecimal } from "@/domain/decimal";
import { localIdSchema } from "@/domain/validation";
import { SettlementForm } from "../_components/settlement-form";

export const metadata: Metadata = { title: "Approve rounding reduction" };
type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function RoundingPage({ searchParams }: Props = {}) {
  const params = await searchParams ?? {};
  const data = await getPaymentsWorkspace({ supplierId: params.supplierId, currency: params.currency });
  if (!data.canReduce) notFound();
  const parsed = localIdSchema.safeParse(params.payableId);
  if (!parsed.success) notFound();
  const payable = data.payables.find((row) => row.id === parsed.data);
  if (!data.supplier || !payable || !payable.paymentId) notFound();
  const allowance = formatDecimal(BigInt(99) - parseNonNegativeDecimal(payable.reductions, 2), 2);
  if (allowance === "0.00") notFound();
  return <div className="space-y-7">
    <PageHeader title={<T>Approve rounding reduction</T>} description={<T>Keep the original cash and receipt amount. Record the supplier's agreement to reduce this specific receipt's remaining debt.</T>}
      action={<Button asChild variant="outline"><Link href={`/payments?supplierId=${data.supplier.id}&currency=${data.currency}`}><T>Back to supplier payments</T></Link></Button>} />
    <Panel className="max-w-3xl space-y-6">
      <div className="space-y-2 text-sm leading-6 [overflow-wrap:anywhere]">
        <p><T>Supplier:</T> <bdi dir="auto">{data.supplier.name}</bdi></p>
        <p><T>Outstanding receipt debt:</T> <bdi dir="ltr" className="tabular-nums">{payable.outstanding} {data.currency}</bdi></p>
        <p><T>Remaining lifetime allowance:</T> <bdi dir="ltr" className="tabular-nums">{allowance} {data.currency}</bdi></p>
        <p className="text-ink-muted"><T>The lifetime limit is 0.99 per payable. This reduction is not a cash payment.</T></p>
        <Link href={`/purchases/${payable.purchaseId}#receipt-${payable.receiptId}`} className="inline-flex min-h-11 items-center text-primary underline"><T>Review accepted receipt</T></Link>
      </div>
      <SettlementForm key={`${data.organizationId}:${payable.id}`} kind="reduction" requestId={randomUUID()} paymentId={payable.paymentId} payableId={payable.id} />
    </Panel>
  </div>;
}
