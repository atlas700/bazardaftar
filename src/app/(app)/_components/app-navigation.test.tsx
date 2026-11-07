import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/products/123" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children, useGT: () => (text: string) => text }));

import { AppNavigation } from "./app-navigation";
import { businessRoles, hasPermission } from "@/auth/permissions";

describe("workspace navigation", () => {
  it("keeps the products section current when viewing a product", () => {
    state.pathname = "/products/123";
    const markup = renderToStaticMarkup(<AppNavigation role="owner" />);
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/products"/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("marks nested settings and avoids matching unrelated path prefixes", () => {
    state.pathname = "/settings/catalog";
    expect(renderToStaticMarkup(<AppNavigation role="owner" />)).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/settings"/);
    state.pathname = "/products-other";
    expect(renderToStaticMarkup(<AppNavigation role="owner" />)).not.toContain('aria-current="page"');
  });

  it.each(businessRoles)("only offers routes allowed for %s", (role) => {
    const html = renderToStaticMarkup(<AppNavigation role={role} />);
    expect(html.includes('href="/purchases"')).toBe(hasPermission(role, "purchases.read"));
    expect(html.includes('href="/payments"')).toBe(hasPermission(role, "supplier_payments.read"));
    expect(html.includes('href="/suppliers"')).toBe(hasPermission(role, "suppliers.read"));
    expect(html).toContain('href="/products"');
  });

  it("offers no business routes to an unrecognized role", () => {
    expect(renderToStaticMarkup(<AppNavigation role="unknown" />)).not.toContain("href=");
  });

  it("keeps supplier details in the current navigation section", () => {
    state.pathname = "/suppliers/123";
    expect(renderToStaticMarkup(<AppNavigation role="owner" />)).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/suppliers"/);
  });
  it("offers purchase drafts as available", () => {
    state.pathname = "/purchases/new";
      const html = renderToStaticMarkup(<AppNavigation role="manager" />);
      const purchaseLink = html.match(/<a[^>]*href="\/purchases"[^>]*>[\s\S]*?<\/a>/)?.[0];
      expect(purchaseLink).toContain('aria-current="page"');
      expect(purchaseLink).not.toContain("Soon");
  });

  it("offers supplier payments and keeps sales outside the pilot", () => {
    state.pathname = "/payments/new";
      const html = renderToStaticMarkup(<AppNavigation role="owner" />);
      const paymentLink = html.match(/<a[^>]*href="\/payments"[^>]*>[\s\S]*?<\/a>/)?.[0];
      expect(paymentLink).toContain('aria-current="page"');
      expect(paymentLink).not.toContain("Soon");
      expect(html).toContain("Outside pilot");
  });
  it("offers inventory as available for every business role", () => {
    state.pathname = "/inventory";
    for (const role of businessRoles) {
      const html = renderToStaticMarkup(<AppNavigation role={role} />);
      const inventoryLink = html.match(/<a[^>]*href="\/inventory"[^>]*>[\s\S]*?<\/a>/)?.[0];
      expect(inventoryLink).toContain('aria-current="page"');
      expect(inventoryLink).not.toContain("Soon");
    }
  });
});
