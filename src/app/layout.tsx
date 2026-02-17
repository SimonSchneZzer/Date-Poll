import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app/AppShell";
import { getRequestUserAndPolls } from "@/lib/date-poll/request-context";
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
  const { user: currentUser, polls: initialAccountPolls } = await getRequestUserAndPolls()

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
