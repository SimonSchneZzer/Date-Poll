import { randomUUID } from "node:crypto"

import type { NextResponse } from "next/server"

export const GUEST_PARTICIPANT_COOKIE = "tp_guest_participant"

const GUEST_TOKEN_RE = /^[A-Za-z0-9-]{16,128}$/

export function parseGuestToken(rawToken: string | undefined): string | null {
  if (!rawToken) return null

  const trimmed = rawToken.trim()
  if (!GUEST_TOKEN_RE.test(trimmed)) {
    return null
  }

  return trimmed
}

export function createGuestToken(): string {
  return randomUUID()
}

export function setGuestTokenCookie(response: NextResponse, guestToken: string) {
  response.cookies.set(GUEST_PARTICIPANT_COOKIE, guestToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}
