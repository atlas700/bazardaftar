"use client";

import { Button } from "@/components/ui/button";
import { errorReference } from "@/diagnostics/failure";
import "./globals.css";

export default function GlobalError({ error, retry }: { error?: unknown; retry: () => void }) {
  const reference = errorReference(error);
  // The root providers may have failed, so this last-resort screen is standalone.
  return <html lang="en" dir="ltr"><body className="min-h-dvh bg-page font-sans text-ink">
    <main className="mx-auto max-w-xl space-y-5 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">BazarDaftar is unavailable</h1>
      <p role="alert">Your workspace could not load. Please try again.</p>
      {reference && <p className="text-sm text-ink-muted">Reference: <bdi dir="ltr">{reference}</bdi></p>}
      <Button type="button" variant="outline" onClick={retry}>Try again</Button>
    </main>
  </body></html>;
}
