"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function InventoryError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Inventory could not be loaded. Please try again.</T></ErrorState>;
}
