export const themeStorageKey = "bazardaftar-theme";

// Runs before paint; only the two supported values can reach the document.
export const themeScript = `(() => {
  let theme;
  try { theme = localStorage.getItem("${themeStorageKey}"); } catch {}
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();`;
