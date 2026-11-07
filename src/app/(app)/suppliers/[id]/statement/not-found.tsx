import Link from "next/link";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace";
export default function StatementNotFound() {
  return <PageHeader title={<T>Supplier account unavailable</T>} description={<T>This supplier or statement page could not be found in your business, or you do not have access.</T>}
    action={<Button asChild variant="outline"><Link href="/suppliers"><T>Back to suppliers</T></Link></Button>} />;
}
