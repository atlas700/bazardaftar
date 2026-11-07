import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { themeScript, themeStorageKey } from "./theme";

describe("theme before first paint", () => {
  it.each([
    ["dark", false, "dark"],
    ["light", true, "light"],
    [null, true, "dark"],
    [null, false, "light"],
    ["unexpected", true, "dark"],
    ["unexpected", false, "light"],
  ])("uses saved %s and system dark=%s to resolve %s", (saved, systemDark, expected) => {
    const document = { documentElement: { dataset: { theme: "" } } };
    const getItem = vi.fn(() => saved);
    runInNewContext(themeScript, { document, localStorage: { getItem }, matchMedia: () => ({ matches: systemDark }) });
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(getItem).toHaveBeenCalledWith(themeStorageKey);
  });

  it("falls back to the system preference when storage access is denied", () => {
    const document = { documentElement: { dataset: { theme: "" } } };
    runInNewContext(themeScript, {
      document,
      localStorage: { getItem: () => { throw new Error("Storage denied"); } },
      matchMedia: () => ({ matches: true }),
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
