import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
import { ErrorState } from "@/components/feedback";
import RootError from "./error";
import NotFound from "./not-found";
import ProductsError from "./(app)/products/error";
import CatalogError from "./(app)/settings/catalog/error";
import StaffError from "./(app)/settings/staff/error";
import StaffAccessError from "./join/error";

describe("safe route recovery", () => {
  it("connects Try again to the server-data retry callback", () => {
    const retry = vi.fn();
    const view = ErrorState({ children: "Unavailable", retry });
    view.props.children[2].props.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });
  it.each([ProductsError, CatalogError, StaffError])("forwards retry through workspace error views", (Page) => {
    const retry = vi.fn();
    const view = Page({ retry });
    expect(view.props.retry).toBe(retry);
  });
  it("gives shared workspace failures and missing pages a safe return path", () => {
    const error = renderToStaticMarkup(<RootError retry={() => {}} />);
    expect(error).toContain("Try again");
    expect(error).toContain('href="/join"');
    const missing = renderToStaticMarkup(<NotFound />);
    expect(missing).toContain("BazarDaftar");
    expect(missing).toContain('href="/dashboard"');
    expect(missing).not.toContain("permission");
  });
  it("keeps staff-access failures recoverable", () => {
    const props = { retry: () => {}, reset: () => {} };
    expect(renderToStaticMarkup(StaffAccessError(props))).toContain("Try again");
  });
});
