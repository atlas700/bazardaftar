"use client";

import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";

export default function SuppliersError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Suppliers could not be loaded. Please try again.</T></ErrorState>;
}
