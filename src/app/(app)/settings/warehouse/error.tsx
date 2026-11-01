"use client";

import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";

export default function WarehouseError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Warehouse settings could not be loaded. Please try again.</T></ErrorState>;
}
