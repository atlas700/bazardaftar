"use server";

import { actionFailure } from "@/diagnostics/server";
import { z } from "zod";
import { getOrCreateCreatorOrganization } from "@/auth/onboarding";
import { requireSession } from "@/auth/server";
import { completeOnboarding, pinOnboardingOrganization, reserveOnboarding } from "@/db/onboarding";
import type { OnboardingState } from "./_lib/state";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  businessType: z.string().trim().min(1).max(100),
  timezone: z.string().trim().min(1).max(100).refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }),
  baseCurrency: z.literal("AFN"),
  locale: z.enum(["en-US", "ps-AF"]),
});

export async function createFirstOrganization(_previous: OnboardingState, formData: FormData): Promise<OnboardingState> {
  let stage = "authentication";
  try {
    const { userId } = await requireSession();
    const parsed = schema.safeParse(formData instanceof FormData ? {
      name: formData.get("name"),
      businessType: formData.get("businessType"),
      timezone: formData.get("timezone"),
      baseCurrency: formData.get("baseCurrency"),
      locale: formData.get("locale"),
    } : null);
    if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "form")))] };

    stage = "reservation";
    const request = await reserveOnboarding(userId, parsed.data);
    if (request.name !== parsed.data.name || request.businessType !== parsed.data.businessType ||
      request.timezone !== parsed.data.timezone || request.baseCurrency !== parsed.data.baseCurrency || request.locale !== parsed.data.locale) {
      return { status: "conflict" };
    }
    stage = "clerk-provisioning";
    const membership = await getOrCreateCreatorOrganization(request);
    if (!membership) return { status: "denied" };
    const { clerkOrganizationId } = membership;
    stage = "clerk-reference";
    const pinned = await pinOnboardingOrganization(request, clerkOrganizationId);
    stage = "local-provisioning";
    if (!await completeOnboarding(pinned, membership)) return { status: "denied" };
    return { status: "success", clerkOrganizationId };
  } catch (error) {
    return actionFailure("organization_onboarding_failed", stage, error);
  }
}
