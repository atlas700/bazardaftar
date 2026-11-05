import Link from "next/link";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/workspace";
export default function NotFound() {
  return <div className="space-y-7"><PageHeader title={<T>Inventory unavailable</T>} />
    <Panel className="space-y-4"><p className="text-sm leading-6 text-ink-muted"><T>This inventory view is unavailable for the current business or access.</T></p>
      <Button asChild variant="outline"><Link href="/inventory"><T>Back to inventory</T></Link></Button>
    </Panel></div>;
}
