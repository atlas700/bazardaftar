import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ value: "en-US", available: ["en-US", "ps-AF"], setLocale: vi.fn() }));
vi.mock("gt-next", () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (value: string) => value,
  useLocaleDirection: () => locale.value === "ps-AF" ? "rtl" : "ltr",
  useLocaleSelector: () => ({ locale: locale.value, locales: locale.available, setLocale: locale.setLocale,
    getLocaleProperties: (value: string) => ({ nativeNameWithRegionCode: value === "ps-AF" ? "پښتو (AF)" : "English (US)" }) }),
  // GT's built-in picker has a native select surface; this is the regression.
  LocaleSelector: () => <select aria-label="Language"><option>English (US)</option></select>,
}));
import { LocalePicker } from "./locale-picker";

afterEach(() => { locale.value = "en-US"; locale.available = ["en-US", "ps-AF"]; vi.clearAllMocks(); });
describe("Radix language picker", () => {
  it.each(["en-US", "ps-AF"])("renders a labelled Radix trigger with the current %s label before hydration", (value) => {
    locale.value = value;
    const html = renderToStaticMarkup(<LocalePicker />);
    expect(html).toMatch(/<button[^>]*role="combobox"/);
    expect(html).toContain('aria-label="Language"');
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain(value === "ps-AF" ? "پښتو (AF)" : "English (US)");
    expect(html).toContain(`dir="${value === "ps-AF" ? "rtl" : "ltr"}"`);
    // Radix may render a hidden native select for form integration.
    expect(html).not.toMatch(/<select(?![^>]*aria-hidden="true")/);
  });
  it("delegates language switching to GT instead of creating a second navigation path", () => {
    const view = LocalePicker();
    view?.props.onValueChange("ps-AF");
    expect(locale.setLocale).toHaveBeenCalledExactlyOnceWith("ps-AF");
  });
  it("omits the control when no locales are configured", () => {
    locale.available = [];
    expect(renderToStaticMarkup(<LocalePicker />)).toBe("");
  });
});
