"use client";

import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";

export default function SuppliersError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Suppliers could not be loaded. Please try again.</T></ErrorState>;
}
