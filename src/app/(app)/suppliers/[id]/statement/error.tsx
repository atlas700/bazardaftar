"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function StatementError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Supplier account could not be loaded. Please try again.</T></ErrorState>;
}
