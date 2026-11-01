import Link from "next/link";
import { T } from "gt-next";
import { LocalePicker } from "./_components/locale-picker";
import { Brand } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Scale, Users } from "lucide-react";
import { getSession } from "@/auth/server";

export default async function Home() {
  const session = await getSession();
  return (
    <div className="min-h-dvh bg-page">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 sm:px-10"><Brand /><LocalePicker /></header>
      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:gap-20 lg:py-28">
        <section>
          <p className="mb-5 text-sm font-medium text-ink-muted"><T>Built around your business</T></p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-ink sm:text-6xl"><T>A clearer way to run your trading day.</T></h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-ink-muted"><T>Your products, measures, and people. Together in one considered workspace.</T></p>
          <div className="mt-9 flex flex-wrap gap-3">
            {!session && <Button asChild className="px-6"><Link href="/sign-in"><T>Sign in</T><ArrowRight aria-hidden="true" className="rtl:-scale-x-100" /></Link></Button>}
            <Button asChild variant={session ? "default" : "outline"}><Link href="/dashboard" prefetch={false}><T>Open workspace</T></Link></Button>
          </div>
          <p className="mt-5 text-sm text-ink-muted"><T>Joining your team?</T> <Link href="/join" prefetch={false} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"><T>Staff access</T></Link></p>
        </section>
        <section className="overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-[0_16px_64px_#1d1d1f08]" aria-labelledby="workspace-intro">
          <div className="border-b border-border/70 px-7 py-7"><p className="text-xs font-medium text-ink-muted">BazarDaftar</p><h2 id="workspace-intro" className="mt-2 text-xl font-semibold tracking-tight"><T>A place for the essentials.</T></h2></div>
          <div className="divide-y divide-border/60 px-7">
            <div className="flex gap-4 py-7"><Package className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" /><div><h3 className="text-sm font-semibold"><T>Your products</T></h3><p className="mt-2 text-sm leading-6 text-ink-muted"><T>A clear catalogue of what you trade.</T></p></div></div>
            <div className="flex gap-4 py-7"><Scale className="mt-1 size-5 shrink-0 text-success" aria-hidden="true" /><div><h3 className="text-sm font-semibold"><T>Your measures</T></h3><p className="mt-2 text-sm leading-6 text-ink-muted"><T>Local weight units. Exact definitions.</T></p></div></div>
            <div className="flex gap-4 py-7"><Users className="mt-1 size-5 shrink-0 text-[#7950a3]" aria-hidden="true" /><div><h3 className="text-sm font-semibold"><T>Your people</T></h3><p className="mt-2 text-sm leading-6 text-ink-muted"><T>A shared workspace with the right access.</T></p></div></div>
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl border-t border-border/70 px-6 py-6 text-xs text-ink-muted sm:px-10">BazarDaftar · <T>Trading workspace</T></footer>
    </div>
  );
}
