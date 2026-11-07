"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function DashboardError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <ErrorState retry={retry} error={error}><T>Dashboard could not be loaded. Please try again.</T></ErrorState>;
}
