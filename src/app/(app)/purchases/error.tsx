"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function PurchasesError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Purchases could not be loaded. Please try again.</T></ErrorState>;
}
