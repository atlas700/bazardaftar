import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { T } from "gt-next";
import { PageHeader, Panel } from "@/components/workspace";
import { getPurchase } from "@/db/purchases";
import { getReceiptUnits } from "@/db/receipts";
import { ReceiptForm } from "../../_components/receipt-form";

export const metadata: Metadata = { title: "Accept delivery" };
export default async function ReceivePurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (!purchase.canAccept || !["ordered", "partially_received"].includes(purchase.status)) redirect(`/purchases/${purchase.id}`);
  const units = await getReceiptUnits();
  return <div className="space-y-7">
    <Link href={`/purchases/${purchase.id}`} className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-primary"><T>Back to purchase</T></Link>
    <PageHeader title={<T>Accept delivery</T>} description={<bdi dir="auto">{purchase.supplierName} · {purchase.warehouseName}</bdi>} />
    <Panel className="shadow-none"><ReceiptForm key={`${purchase.organizationId}:${purchase.id}:${purchase.revision}`} purchase={purchase} units={units} requestId={randomUUID()} /></Panel>
  </div>;
}
