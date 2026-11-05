import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
import { getAdjustmentOptions } from "@/db/inventory-adjustments";
import { AdjustmentForm } from "./_components/adjustment-form";

export const metadata: Metadata = { title: "Stock adjustment" };

export default async function AdjustmentPage() {
  const options = await getAdjustmentOptions();
  return <div className="space-y-7">
    <PageHeader title={<T>Record stock adjustment</T>} description={<T>Record opening stock or correct a physical count. Every adjustment keeps its reason and owner approval.</T>}
      action={<Button asChild variant="outline"><Link href="/inventory"><T>Back to inventory</T></Link></Button>} />
    <Panel className="max-w-3xl">
      {!options.products.length || !options.warehouse ? <div className="space-y-4">
        <p className="text-sm leading-6 text-ink-muted"><T>An active product and warehouse are required before recording an adjustment.</T></p>
        <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/products"><T>Open products</T></Link></Button>
          <Button asChild variant="outline"><Link href="/settings/warehouse"><T>Open warehouse settings</T></Link></Button></div>
      </div> : <AdjustmentForm key={options.organizationId} products={options.products} warehouse={options.warehouse} requestId={randomUUID()} />}
    </Panel>
  </div>;
}
