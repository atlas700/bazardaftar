import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/workspace";
import { errorReference } from "@/diagnostics/failure";

export function LoadingState({ children }: { children: ReactNode }) {
  return <div role="status" className="space-y-6">
    <p className="flex items-center gap-3 text-sm text-ink-muted"><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />{children}</p>
    <div aria-hidden="true" className="space-y-4 rounded-2xl border border-border/70 bg-surface p-6 motion-safe:animate-pulse">
      <div className="h-5 w-2/5 rounded-md bg-muted" /><div className="h-4 w-3/5 rounded-md bg-muted" /><div className="h-24 rounded-xl bg-page" />
    </div>
  </div>;
}

export function ErrorReference({ error }: { error?: unknown }) {
  const reference = errorReference(error);
  return reference ? <p className="text-sm text-ink-muted"><T>Reference:</T> <bdi dir="ltr">{reference}</bdi></p> : null;
}

export function ErrorState({ children, retry, error }: { children: ReactNode; retry: () => void; error?: unknown }) {
  return <Panel className="flex flex-col items-start gap-5">
    <span className="grid size-11 place-items-center rounded-xl bg-destructive/5 text-destructive"><AlertCircle className="size-5" aria-hidden="true" /></span>
    <p role="alert" className="max-w-lg text-sm leading-7">{children}</p>
    <ErrorReference error={error} />
    <Button type="button" variant="outline" onClick={retry}><T>Try again</T></Button>
  </Panel>;
}
