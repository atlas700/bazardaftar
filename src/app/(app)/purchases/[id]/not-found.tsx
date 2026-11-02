import Link from "next/link";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace";
export default function NotFound() {
  return <PageHeader title={<T>Purchase unavailable</T>} description={<T>This purchase could not be found in your business, or you do not have access.</T>}
    action={<Button asChild variant="outline"><Link href="/purchases"><T>Back to purchases</T></Link></Button>} />;
}
