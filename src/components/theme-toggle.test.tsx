import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("gt-next", () => ({ T: ({ children }: { children: ReactNode }) => children }));
import { ThemeToggle } from "./theme-toggle";
import { themeStorageKey } from "@/lib/theme";

afterEach(() => vi.unstubAllGlobals());

describe("theme control", () => {
  it.each(["light", "dark"])("switches away from %s and saves the choice", (theme) => {
    const root = { dataset: { theme } };
    const setItem = vi.fn();
    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("localStorage", { setItem });
    ThemeToggle().props.onClick();
    const expected = theme === "dark" ? "light" : "dark";
    expect(root.dataset.theme).toBe(expected);
    expect(setItem).toHaveBeenCalledExactlyOnceWith(themeStorageKey, expected);
  });

  it("switches even when saving the choice is blocked", () => {
    const root = { dataset: { theme: "light" } };
    vi.stubGlobal("document", { documentElement: root });
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("Storage denied"); } });
    expect(() => ThemeToggle().props.onClick()).not.toThrow();
    expect(root.dataset.theme).toBe("dark");
  });

  it("renders both CSS-controlled accessible action labels without browser access", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain("Switch to dark theme");
    expect(html).toContain("Switch to light theme");
    expect(html).toContain('type="button"');
  });
});
