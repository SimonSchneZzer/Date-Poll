import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import { AppShell } from "@/components/app/AppShell"
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
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = stored === "dark" || stored === "light" ? stored : preferred;
    document.documentElement.classList.toggle("dark", theme === "dark");
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
        <AppShell initialUser={currentUser} initialAccountPolls={initialAccountPolls}>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
