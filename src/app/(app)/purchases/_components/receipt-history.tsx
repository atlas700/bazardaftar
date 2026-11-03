import { T } from "gt-next";
import type { getPurchase } from "@/db/purchases";
import { Panel } from "@/components/workspace";
import { PurchaseNumber, trimPurchaseQuantity } from "./purchase-number";

export function ReceiptHistory({ purchase }: { purchase: Pick<Awaited<ReturnType<typeof getPurchase>>, "receipts" | "currency"> }) {
  return <Panel className="space-y-5 shadow-none" aria-labelledby="accepted-deliveries">
    <h2 id="accepted-deliveries" className="font-semibold"><T>Accepted deliveries</T></h2>
    {purchase.receipts.length === 0 ? <p className="text-sm text-ink-muted"><T>No accepted deliveries yet.</T></p> : <ol className="divide-y divide-border/70">{purchase.receipts.map((receipt) => <li key={receipt.id} id={`receipt-${receipt.id}`} className="space-y-4 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap justify-between gap-3"><time dir="ltr" className="text-sm" dateTime={receipt.acceptedAt.toISOString()}>{receipt.acceptedAt.toISOString().slice(0, 19).replace("T", " ")} <T>UTC</T></time>
        <p className="font-semibold"><PurchaseNumber value={receipt.total} currency={purchase.currency} /></p></div>
      <p className="break-all text-xs text-ink-muted"><T>Receipt reference</T>: <bdi dir="ltr">{receipt.id}</bdi></p>
      <ul className="space-y-3 text-sm">{receipt.items.map((item) => <li key={item.id} className="space-y-1">
        <p className="break-words font-medium"><bdi dir="auto">{item.productName}</bdi></p>
        <p className="text-ink-muted"><PurchaseNumber value={trimPurchaseQuantity(item.quantity)} /> <bdi dir="auto">{item.quantityUnitName}</bdi> · <PurchaseNumber value={item.quantityMeasureKg} /> <T>kg per measure</T> · <PurchaseNumber value={item.quantityKg} /> <T>kg accepted</T></p>
        <p><T>Supplier debt</T>: <PurchaseNumber value={item.recognizedValue} currency={purchase.currency} /></p>
      </li>)}</ul>
      {receipt.varianceReason && <p className="break-words text-sm"><T>Owner-approved variance</T>: <bdi dir="auto">{receipt.varianceReason}</bdi></p>}
      {receipt.completesPurchase && <p className="text-sm text-ink-muted"><T>Final accepted delivery</T></p>}
    </li>)}</ol>}
  </Panel>;
}
