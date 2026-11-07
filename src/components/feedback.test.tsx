import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("gt-next", () => ({ T: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
import { ErrorState } from "./feedback";

describe("safe error feedback", () => {
  it("shows only the server digest as a support reference and retains retry", () => {
    const html = renderToStaticMarkup(<ErrorState retry={() => {}} error={Object.assign(new Error("private SQL"), { digest: "123456789" })}>Stock could not load.</ErrorState>);
    expect(html).toContain("Reference:");
    expect(html).toContain("123456789");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("private");
  });
  it.each([undefined, null, "private", { digest: "private SQL" }, { digest: "9".repeat(100) }, { digest: "NEXT_REDIRECT;/private" }])("omits unavailable or unsafe references", (error) => {
    const html = renderToStaticMarkup(<ErrorState retry={() => {}} error={error}>Stock could not load.</ErrorState>);
    expect(html).not.toContain("Reference:");
    expect(html).not.toContain("private");
  });
});
