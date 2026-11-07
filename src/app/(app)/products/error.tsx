"use client";

import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";

export default function ProductsError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Products could not load. Please try again.</T></ErrorState>;
}
