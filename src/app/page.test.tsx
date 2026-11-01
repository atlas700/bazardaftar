import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/auth/server", () => ({ getSession }));
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
vi.mock("./_components/locale-picker", () => ({ LocalePicker: () => <select aria-label="Language" /> }));
import Home from "./page";

afterEach(() => vi.resetAllMocks());

describe("homepage session actions", () => {
  it("offers sign-in to anonymous visitors", async () => {
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());
    expect(getSession).toHaveBeenCalledOnce();
    expect(html).toContain("BazarDaftar");
    expect(html).not.toContain("AFCS");
    expect(html).not.toContain("Afghanistan Agricultural Supply Chain OS");
    expect(html).toContain('href="/sign-in"');
    expect(html).not.toContain("Sign up");
  });

  it("offers the guarded workspace without sign-in prompts to an existing session", async () => {
    getSession.mockResolvedValue({ userId: "user_existing" });
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain('href="/sign-in"');
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("user_existing");
  });
});
