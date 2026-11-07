"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function PurchasesError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Purchases could not be loaded. Please try again.</T></ErrorState>;
}
