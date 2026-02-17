import type { Metadata } from "next"
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

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const stored = window.localStorage.getItem("theme");
    const normalizedStored = stored === "prism" ? "salmon" : stored;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = normalizedStored === "light" || normalizedStored === "salmon" || normalizedStored === "rainbow" || normalizedStored === "graphite" || normalizedStored === "dark" ? normalizedStored : preferred;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark" || theme === "graphite");
    root.classList.toggle("salmon", theme === "salmon");
    root.classList.toggle("rainbow", theme === "rainbow");
    root.classList.toggle("prism", false);
    root.classList.toggle("graphite", theme === "graphite");
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
  const { user: currentUser, polls: initialAccountPolls } = await getRequestUserAndPolls()

  return (
    <html lang="en" suppressHydrationWarning>
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
