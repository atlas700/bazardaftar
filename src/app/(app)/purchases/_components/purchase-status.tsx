import { T } from "gt-next";

export function PurchaseStatus({ status }: { status: "draft" | "ordered" | "partially_received" | "received" | "cancelled" }) {
  return <span className="inline-flex rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
    {status === "draft" ? <T>Draft</T> : status === "ordered" ? <T>Ordered</T> : status === "partially_received" ? <T>Partially received</T> : status === "received" ? <T>Received</T> : <T>Cancelled</T>}
  </span>;
}
