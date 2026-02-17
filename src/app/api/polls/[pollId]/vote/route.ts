import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import {
  createGuestToken,
  GUEST_PARTICIPANT_COOKIE,
  parseGuestToken,
  setGuestTokenCookie,
} from "@/lib/date-poll/guest-cookie"
import { upsertParticipantVotes } from "@/lib/date-poll/store"
import { setVotedPollCookie, VOTED_POLLS_COOKIE } from "@/lib/date-poll/vote-cookie"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const { pollId } = await context.params
  const user = await getCurrentUserFromCookies(request.cookies)
  const payload = (await request.json().catch(() => null)) as
    | {
        fullName?: string
        votes?: Record<string, unknown>
      }
    | null

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ errors: ["Invalid request body"] }, { status: 400 })
  }

  const existingGuestToken = parseGuestToken(request.cookies.get(GUEST_PARTICIPANT_COOKIE)?.value)
  const guestToken = existingGuestToken ?? (user ? undefined : createGuestToken())

  const result = await upsertParticipantVotes({
    pollId,
    fullName: payload.fullName ?? "",
    authUserId: user?.id,
    guestToken,
    votes: payload.votes ?? {},
  })

  if (result.errors) {
    const status = result.errors.includes("Poll not found") ? 404 : 400
    return NextResponse.json({ errors: result.errors }, { status })
  }

  const response = NextResponse.json({ poll: result.poll }, { status: 200 })
  if (!user && guestToken) {
    setGuestTokenCookie(response, guestToken)
  }

  setVotedPollCookie({
    response,
    existingCookieValue: request.cookies.get(VOTED_POLLS_COOKIE)?.value,
    pollId,
  })

  return response
}
