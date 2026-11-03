import { T } from "gt-next";

export function PurchaseStatus({ status }: { status: "draft" | "ordered" | "cancelled" }) {
  return <span className="inline-flex rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
    {status === "draft" ? <T>Draft</T> : status === "ordered" ? <T>Ordered</T> : <T>Cancelled</T>}
  </span>;
}
