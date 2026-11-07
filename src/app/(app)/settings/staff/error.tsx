"use client";

import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";

export default function StaffError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Staff could not load. Please try again.</T></ErrorState>;
}
