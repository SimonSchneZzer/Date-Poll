import type { NextResponse } from "next/server"

export const VOTED_POLLS_COOKIE = "tp_voted_polls"

const COOKIE_MAX_IDS = 200

function parseCookieValue(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return []
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function serializeCookieValue(pollIds: string[]): string {
  return pollIds.join(",")
}

export function hasVotedInPoll(rawCookieValue: string | undefined, pollId: string): boolean {
  return parseCookieValue(rawCookieValue).includes(pollId)
}

export function setVotedPollCookie(args: {
  response: NextResponse
  existingCookieValue: string | undefined
  pollId: string
}) {
  const unique = new Set(parseCookieValue(args.existingCookieValue))
  unique.add(args.pollId)

  const nextPollIds = Array.from(unique).slice(-COOKIE_MAX_IDS)

  args.response.cookies.set(VOTED_POLLS_COOKIE, serializeCookieValue(nextPollIds), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}
