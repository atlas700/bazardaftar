"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function PaymentError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Supplier payments could not be loaded. Please try again.</T></ErrorState>;
}
