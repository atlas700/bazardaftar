import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/auth/server", () => ({ getSession }));
vi.mock("@/auth/components", () => ({ SignOut: () => <button>Sign out</button> }));
vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
vi.mock("./_components/locale-picker", () => ({ LocalePicker: () => <button type="button" aria-label="Language">English</button> }));
import Home from "./page";

afterEach(() => vi.resetAllMocks());

describe("homepage session actions", () => {
  it("offers the shared theme toggle in the homepage navbar", async () => {
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());
    const header = html.split("</header>")[0];
    expect(header).toContain("Switch to dark theme");
    expect(header).toContain("Switch to light theme");
  });

  it("offers sign-in to anonymous visitors", async () => {
    getSession.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Home());
    expect(getSession).toHaveBeenCalledOnce();
    expect(html).toContain("BazarDaftar");
    expect(html).not.toContain("AFCS");
    expect(html).not.toContain("Afghanistan Agricultural Supply Chain OS");
    expect(html).toContain('href="/sign-in"');
    expect(html).not.toContain("Sign up");
    expect(html).not.toContain("Sign out");
  });

  it("offers the guarded workspace without sign-in prompts to an existing session", async () => {
    getSession.mockResolvedValue({ userId: "user_existing" });
    const html = renderToStaticMarkup(await Home());
    expect(html).not.toContain('href="/sign-in"');
    expect(html).toContain('href="/dashboard"');
    const header = html.split("</header>")[0];
    expect(header).toContain('aria-label="Language"');
    expect(header).toContain("<button>Sign out</button>");
    expect(html).not.toContain("user_existing");
  });
});
