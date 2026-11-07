"use client";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
export default function DashboardError({ retry }: { retry: () => void }) {
  return <ErrorState retry={retry}><T>Dashboard could not be loaded. Please try again.</T></ErrorState>;
}
