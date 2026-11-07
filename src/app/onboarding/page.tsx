import type { Metadata } from "next";
import Link from "next/link";
import { safeServerError } from "@/diagnostics/server";
import { T } from "gt-next";
import { getLocale } from "gt-next/server";
import { SignOut } from "@/auth/components";
import { requireSession } from "@/auth/server";
import { getOnboardingRequest } from "@/db/onboarding";
import { LocalePicker } from "../_components/locale-picker";
import { OnboardingForm } from "./_components/onboarding-form";
import { Brand } from "@/components/workspace";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const { userId } = await requireSession();
  const locale = await getLocale();
  let request;
  try {
    request = await getOnboardingRequest(userId);
  } catch (error) {
    throw safeServerError("Business setup unavailable.", error);
  }
  const initialValues = request ? {
    name: request.name,
    businessType: request.businessType,
    timezone: request.timezone,
    baseCurrency: request.baseCurrency,
    locale: request.locale,
  } : { name: "", businessType: "", timezone: "Asia/Kabul", baseCurrency: "AFN", locale };

  return (
    <main className="min-h-dvh bg-page px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Brand />
          <SignOut />
        </header>
        <section className="rounded-3xl border border-border/80 bg-surface p-6 shadow-[0_8px_40px_#1d1d1f05] sm:p-9" aria-labelledby="onboarding-title">
          <h1 id="onboarding-title" className="text-3xl font-semibold tracking-tight text-ink"><T>Set up your business</T></h1>
          <p className="mt-3 mb-5 text-sm leading-7 text-ink-muted"><T>Create your business workspace. If setup is interrupted, return here to continue with the same details.</T></p>
          <Link href="/join" prefetch={false} className="mb-7 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"><T>Joining an existing business? Open staff access.</T></Link>
          <OnboardingForm initialValues={initialValues} resuming={request !== null} />
          <div className="mt-7 border-t border-border pt-5"><LocalePicker /></div>
        </section>
      </div>
    </main>
  );
}
