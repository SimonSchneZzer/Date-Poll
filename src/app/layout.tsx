import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app/AppShell";
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth";
import { getPollSummariesForUser } from "@/lib/date-poll/store";
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
  title: "Date Poll",
  description: "Create date polls and collect participant availability",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies()
  const currentUser = await getCurrentUserFromCookies(cookieStore)
  const initialAccountPolls = currentUser
    ? getPollSummariesForUser(currentUser.id)
    : []

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell initialUser={currentUser} initialAccountPolls={initialAccountPolls}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
