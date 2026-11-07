import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("root layout failure recovery", () => {
  it("works without auth or translation providers and never renders a thrown message", () => {
    const html = renderToStaticMarkup(<GlobalError retry={() => {}} error={Object.assign(new Error("private-token"), { digest: "123456789" })} />);
    for (const text of ["<html", "<body", "BazarDaftar", "Try again", "123456789", 'role="alert"']) expect(html).toContain(text);
    expect(html).not.toContain("private-token");
  });
  it("connects recovery to Next's retry callback", () => {
    const retry = vi.fn();
    const view = GlobalError({ retry, error: null });
    view.props.children.props.children.props.children[3].props.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });
});
