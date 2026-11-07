import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SignOut } from "@/auth/components";
import { requireSession } from "@/auth/server";
import { getTenantContext } from "@/db/tenant";
import { getWorkspaceSummary } from "@/db/workspace";
import { Building2 } from "lucide-react";
import { T } from "gt-next";
import { Brand } from "@/components/workspace";
import { LocalePicker } from "@/app/_components/locale-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppNavigation, WorkspaceLocation } from "./_components/app-navigation";
import { MobileNavigation } from "./_components/mobile-navigation";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  await requireSession();
  if (!await getTenantContext()) redirect("/onboarding");
  const workspace = await getWorkspaceSummary();
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a
        className="sr-only rounded bg-primary px-4 py-3 font-semibold text-on-primary focus:not-sr-only focus:absolute focus:top-4 focus:start-4 focus:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        href="#main-content"
      >
        <T>Skip to content</T>
      </a>
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-e border-border/70 bg-sidebar lg:flex lg:flex-col">
        <Link
          className="px-6 py-8 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring"
          href="/dashboard"
        >
          <Brand />
        </Link>
        <div className="flex-1 px-4 py-3">
          <p className="mb-3 px-3 text-[11px] font-medium text-ink-muted"><T>Your business</T></p>
          <AppNavigation role={workspace.role} />
        </div>
        <div className="mx-4 border-t border-border px-2 py-5">
          <p className="mb-3 text-xs leading-5 text-ink-muted"><T>Trading workspace</T></p>
          <SignOut />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center gap-2 border-b border-border/70 bg-surface px-4 py-3 sm:px-7 lg:gap-4 lg:px-10">
          <MobileNavigation role={workspace.role}><SignOut /></MobileNavigation>
          <div className="min-w-0 flex-1 basis-40 space-y-1">
            <Link href="/join" prefetch={false} className="flex min-h-11 max-w-full items-center gap-2 text-sm font-semibold hover:text-primary">
              <Building2 aria-hidden="true" className="size-4 shrink-0" />
              <bdi dir="auto" className="min-w-0 break-words">{workspace.name}</bdi>
              <span className="sr-only"><T>Switch business</T></span>
            </Link>
            <div className="hidden sm:block"><WorkspaceLocation /></div>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:block"><LocalePicker /></div>
          </div>
        </header>
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2 sm:hidden">
          <WorkspaceLocation />
          <LocalePicker />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 py-7 outline-none sm:px-7 sm:py-10 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
