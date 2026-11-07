import type { Metadata } from "next";
import { safeServerError } from "@/diagnostics/server";
import { T } from "gt-next";
import { SignOut } from "@/auth/components";
import { OrganizationActivation } from "@/auth/organization-activation";
import { requireSession } from "@/auth/server";
import { getStaffAccessOrganizations } from "@/auth/staff";
import { Brand, PageHeader, Panel } from "@/components/workspace";
import { buttonVariants } from "@/components/ui/button";
import { LocalePicker } from "@/app/_components/locale-picker";

export const metadata: Metadata = { title: "Staff access" };

export default async function StaffAccessPage() {
  const { userId } = await requireSession();
  let memberships;
  try {
    memberships = await getStaffAccessOrganizations(userId);
  } catch (error) {
    throw safeServerError("Staff access unavailable.", error);
  }
  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-7 px-4 py-10 sm:px-6">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4"><Brand /><div className="flex flex-wrap items-center gap-2"><LocalePicker /><SignOut /></div></div>
      <PageHeader title={<T>Staff access</T>} description={<T>Share your account ID with the business owner or admin so they can add you. They must assign a business role before you can open the workspace.</T>} />
      <Panel><p className="text-xs font-medium text-ink-muted"><T>Your account ID</T></p><p className="mt-3 break-all font-mono text-sm" dir="ltr">{userId}</p></Panel>
      <h2 className="text-xl font-semibold"><T>Your businesses</T></h2>
      {memberships.length === 0 && <p><T>You have not joined a business yet. Ask the owner or admin to add your account, then reload this page.</T></p>}
      <ul className="space-y-5">{memberships.map((organization) => (
        <li key={organization.id} className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <h3 className="break-words text-lg font-semibold" dir="auto">{organization.name}</h3>
          <OrganizationActivation organizationId={organization.id} />
        </li>
      ))}</ul>
      <a href="/join" className={buttonVariants({ variant: "outline" })}><T>Reload staff access</T></a>
    </main>
  );
}
