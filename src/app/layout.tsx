import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { GTProvider } from "gt-next";
import { getLocale, getLocaleDirection } from "gt-next/server";
import { AuthProvider } from "@/auth/components";
import { themeScript } from "@/lib/theme";
import "@/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BazarDaftar",
    template: "%s | BazarDaftar",
  },
  description: "A Pashto-first workspace for grain and mixed-goods wholesalers.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const direction = await getLocaleDirection();

  return (
    <html
      dir={direction}
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <GTProvider>
        <body className="min-h-full bg-page font-sans text-ink">
          <AuthProvider
            signInUrl="/sign-in"
            signInFallbackRedirectUrl="/dashboard"
            afterSignOutUrl="/"
          >
            {children}
          </AuthProvider>
        </body>
      </GTProvider>
    </html>
  );
}
