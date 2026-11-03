import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { T } from "gt-next";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/workspace";
import { requirePermission } from "@/db/authorization";
import { getPurchase, getPurchasesWorkspace } from "@/db/purchases";
import { PurchaseForm } from "../../_components/purchase-form";

export const metadata: Metadata = { title: "Edit purchase draft" };
export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("purchases.manage");
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (purchase.status !== "draft") redirect(`/purchases/${purchase.id}`);
  const workspace = await getPurchasesWorkspace();
  const available = workspace.warehouse?.id === purchase.warehouseId && workspace.suppliers.some((item) => item.id === purchase.supplierId)
    && purchase.items.every((item) => workspace.products.some((product) => product.id === item.productId)
      && [item.quantityUnitId, item.priceUnitId].every((unitId) => workspace.units.some((unit) => unit.id === unitId)));
  return <div className="space-y-7">
    <Link href={`/purchases/${purchase.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-primary"><ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" /><T>Purchase details</T></Link>
    <PageHeader title={<T>Edit purchase draft</T>} description={<T>Saved measure weights stay with unchanged selections. New selections use current catalogue weights.</T>} />
    {!available && <p role="status" className="text-sm leading-6 text-ink-muted"><T>Some saved selections are inactive or unavailable. Replace them or ask an owner or admin to reactivate them before saving.</T></p>}
    <Panel className="shadow-none"><PurchaseForm key={`${purchase.organizationId}:${purchase.id}:${purchase.revision}`} workspace={workspace} purchase={purchase} requestId={randomUUID()} /></Panel>
  </div>;
}
