"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T, useGT } from "gt-next";
import { hasPermission } from "@/auth/permissions";
import { ArrowLeftRight, Banknote, Boxes, ContactRound, LayoutGrid, Package, Settings2, ShoppingBag, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", label: <T>Overview</T>, icon: LayoutGrid, soon: false, permission: "organization.read" },
  { href: "/products", label: <T>Products</T>, icon: Package, soon: false, permission: "catalog.read" },
  { href: "/suppliers", label: <T>Suppliers</T>, icon: ContactRound, soon: false, permission: "suppliers.read" },
  { href: "/inventory", label: <T>Inventory</T>, icon: Boxes, soon: true, permission: "inventory.read" },
  { href: "/purchases", label: <T>Purchases</T>, icon: ShoppingCart, soon: false, permission: "purchases.read" },
  { href: "/payments", label: <T>Payments</T>, icon: Banknote, soon: true, permission: "supplier_payments.read" },
  { href: "/sales", label: <T>Sales</T>, icon: ShoppingBag, soon: true, permission: "organization.read" },
  { href: "/settings", label: <T>Settings</T>, icon: Settings2, soon: false, permission: "organization.read" },
] as const;

type AppNavigationProps = {
  role: string;
  compact?: boolean;
};

export function AppNavigation({ role, compact = false }: AppNavigationProps) {
  const pathname = usePathname();
  const gt = useGT();

  return (
    <nav aria-label={gt("Primary navigation")}>
      <ul className={compact ? "flex gap-1" : "space-y-1.5"}>
        {navigationItems.filter(({ permission }) => hasPermission(role, permission)).map(({ href, label, icon: Icon, soon }) => {
          const isCurrent = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className={compact ? "shrink-0" : undefined}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", isCurrent ? "bg-surface text-ink shadow-xs ring-1 ring-black/5" : "text-ink-muted hover:bg-surface/60 hover:text-ink")}
                href={href}
                prefetch={false}
              >
                <Icon className={cn("size-[18px] shrink-0", isCurrent && "text-primary")} aria-hidden="true" />
                <span>{label}</span>
                {soon && <span className="ms-auto rounded px-1.5 py-0.5 text-[11px] font-normal text-ink-muted">{href === "/sales" ? <T>Outside pilot</T> : <T>Soon</T>}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function WorkspaceLocation() {
  const pathname = usePathname();
  const item = navigationItems.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  return <div className="flex min-w-0 items-center gap-2 text-sm text-ink-muted"><ArrowLeftRight aria-hidden="true" className="size-4" /><span className="hidden sm:inline"><T>Workspace</T></span><span className="hidden text-border sm:inline" aria-hidden="true">/</span><span className="truncate font-medium text-ink">{item?.label ?? <T>Workspace</T>}</span></div>;
}
