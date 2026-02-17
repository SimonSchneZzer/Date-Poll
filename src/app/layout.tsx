import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import { AppShell } from "@/components/app/AppShell"
import { AppProviders } from "@/components/app/AppProviders"
import { getRequestUserAndPolls } from "@/lib/date-poll/request-context"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Date Poll",
  description: "Create date polls and collect participant availability",
}

type ThemePreference = "light" | "salmon" | "rainbow" | "graphite" | "dark"

function normalizeThemePreference(rawValue: string | null | undefined): ThemePreference | null {
  const normalizedValue = rawValue === "prism" ? "salmon" : rawValue
  if (
    normalizedValue === "light" ||
    normalizedValue === "salmon" ||
    normalizedValue === "rainbow" ||
    normalizedValue === "graphite" ||
    normalizedValue === "dark"
  ) {
    return normalizedValue
  }
  return null
}

function getThemeHtmlClassName(theme: ThemePreference | null): string {
  if (theme === "dark") return "dark"
  if (theme === "salmon") return "salmon"
  if (theme === "rainbow") return "rainbow"
  if (theme === "graphite") return "dark graphite"
  return ""
}

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const readCookieTheme = () => {
      const match = document.cookie.match(/(?:^|;\\s*)theme=([^;]+)/);
      if (!match) return null;
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    };
    const isValidTheme = (value) =>
      value === "light" ||
      value === "salmon" ||
      value === "rainbow" ||
      value === "graphite" ||
      value === "dark";
    const cookieThemeRaw = readCookieTheme();
    const normalizedCookie = cookieThemeRaw === "prism" ? "salmon" : cookieThemeRaw;
    const stored = window.localStorage.getItem("theme");
    const normalizedStored = stored === "prism" ? "salmon" : stored;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = isValidTheme(normalizedCookie) ? normalizedCookie : isValidTheme(normalizedStored) ? normalizedStored : preferred;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark" || theme === "graphite");
    root.classList.toggle("salmon", theme === "salmon");
    root.classList.toggle("rainbow", theme === "rainbow");
    root.classList.toggle("prism", false);
    root.classList.toggle("graphite", theme === "graphite");
    if (stored !== theme) {
      window.localStorage.setItem("theme", theme);
    }
    if (cookieThemeRaw !== theme) {
      document.cookie = "theme=" + encodeURIComponent(theme) + "; path=/; max-age=31536000; samesite=lax";
    }
    if (stored === "prism") {
      window.localStorage.setItem("theme", "salmon");
    }
  } catch {}
})();
`

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const cookieTheme = normalizeThemePreference(cookieStore.get("theme")?.value)
  const htmlClassName = getThemeHtmlClassName(cookieTheme)
  const { user: currentUser, polls: initialAccountPolls } = await getRequestUserAndPolls()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={htmlClassName || undefined}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <AppProviders>
          <AppShell initialUser={currentUser} initialAccountPolls={initialAccountPolls}>
            {children}
          </AppShell>
        </AppProviders>
      </body>
    </html>
  )
}
