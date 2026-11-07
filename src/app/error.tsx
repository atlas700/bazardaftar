"use client";

import Link from "next/link";
import { T } from "gt-next";
import { ErrorState } from "@/components/feedback";
import { Brand, PageHeader } from "@/components/workspace";
import { Button } from "@/components/ui/button";

export default function RootError({ retry, error }: { retry: () => void; error?: unknown }) {
  return <main className="mx-auto min-h-dvh max-w-2xl space-y-7 px-4 py-10 sm:px-6">
    <Brand />
    <PageHeader title={<T>Workspace unavailable</T>} />
    <ErrorState retry={retry} error={error}><T>Your workspace could not load. Please try again.</T></ErrorState>
    <Button asChild variant="outline"><Link href="/join"><T>Business selection</T></Link></Button>
  </main>;
}
