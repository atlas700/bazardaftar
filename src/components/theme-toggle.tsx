"use client";

import { Moon, Sun } from "lucide-react";
import { T } from "gt-next";
import { Button } from "@/components/ui/button";
import { themeStorageKey } from "@/lib/theme";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The chosen theme still works for this page when storage is blocked.
    }
  }

  return <Button type="button" variant="outline" className="size-11 p-0" onClick={toggleTheme}>
    <Moon aria-hidden="true" className="dark:hidden" />
    <Sun aria-hidden="true" className="hidden dark:block" />
    <span className="sr-only dark:hidden"><T>Switch to dark theme</T></span>
    <span className="sr-only hidden dark:block"><T>Switch to light theme</T></span>
  </Button>;
}
