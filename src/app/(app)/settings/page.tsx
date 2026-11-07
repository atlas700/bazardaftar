import type { Metadata } from "next";
import Link from "next/link";
import { T } from "gt-next";
import { getWorkspaceSummary } from "@/db/workspace";
import { hasPermission } from "@/auth/permissions";
import { ArrowUpRight, ContactRound, Package, Scale, Users, Building2, Warehouse } from "lucide-react";
import { PageHeader, Panel } from "@/components/workspace";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { role } = await getWorkspaceSummary();
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title={<T>Settings</T>} description={<T>Make this workspace work for your business.</T>} />
      <div className="space-y-3"><h2 className="px-1 text-xs font-medium text-ink-muted"><T>Catalogue</T></h2>
        <Panel className="divide-y divide-border/70 overflow-hidden p-0 sm:p-0">
          <Link href="/products" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <Package className="size-5 shrink-0 text-primary" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold"><T>Products</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Names, product codes, and active goods.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>
          <Link href="/settings/catalog" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <Scale className="size-5 shrink-0 text-success" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold"><T>Units and product categories</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Your weight measures and product groups.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </Panel>
      </div>
      <div className="space-y-3"><h2 className="px-1 text-xs font-medium text-ink-muted"><T>People & business</T></h2>
        <Panel className="divide-y divide-border/70 overflow-hidden p-0 sm:p-0">
          {hasPermission(role, "suppliers.read") && <Link href="/suppliers" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <ContactRound className="size-5 shrink-0 text-ink-muted" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold"><T>Suppliers</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Purchase contacts and payment terms.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>}
          <Link href="/settings/warehouse" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <Warehouse className="size-5 shrink-0 text-ink-muted" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold"><T>Warehouse</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Your stock location for purchases and receipts.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>
          {hasPermission(role, "staff.read") && <Link href="/settings/staff" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <Users className="size-5 shrink-0 text-highlight" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold"><T>Manage staff</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Owners and admins can manage staff membership and business roles.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>}
          <Link href="/join" prefetch={false} className="flex items-center gap-4 px-5 py-5 hover:bg-page sm:px-6">
            <Building2 className="size-5 shrink-0 text-ink-muted" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold"><T>Staff access and business selection</T></p><p className="mt-1 text-sm leading-6 text-ink-muted"><T>Open a business you belong to.</T></p></div><ArrowUpRight className="size-4 shrink-0 text-ink-muted rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        </Panel>
      </div>
    </div>
  );
}
