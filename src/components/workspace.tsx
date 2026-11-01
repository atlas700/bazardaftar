import type { ComponentProps, ReactNode } from "react";
import { Sprout } from "lucide-react";
import { T } from "gt-next";
import { cn } from "@/lib/utils";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="flex items-center gap-3">
    <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-ink text-white shadow-sm"><Sprout className="size-6" aria-hidden="true" /></span>
    <span className="text-start"><span className="block text-base font-semibold tracking-tight">BazarDaftar</span>
      {!compact && <span className="block text-xs font-normal tracking-normal text-ink-muted"><T>Trading workspace</T></span>}
    </span>
  </span>;
}

export function PageHeader({ title, description, action, eyebrow }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div className="min-w-0 max-w-2xl">
      {eyebrow && <p className="mb-2 text-xs font-medium text-ink-muted">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-[2rem] sm:leading-tight">{title}</h1>
      {description && <p className="mt-3 text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
  </header>;
}

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-border/80 bg-surface p-5 shadow-[0_2px_8px_#1d1d1f03] sm:p-6", className)} {...props} />;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", active ? "bg-success/8 text-success" : "bg-muted text-ink-muted")}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{active ? <T>Active</T> : <T>Inactive</T>}
  </span>;
}
