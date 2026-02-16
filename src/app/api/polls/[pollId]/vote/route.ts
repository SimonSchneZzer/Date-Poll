import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { upsertParticipantVotes } from "@/lib/date-poll/store"
import { setVotedPollCookie, VOTED_POLLS_COOKIE } from "@/lib/date-poll/vote-cookie"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  const { pollId } = await context.params
  const user = await getCurrentUserFromCookies(request.cookies)
  const payload = (await request.json()) as {
    fullName?: string
    votes?: Record<string, unknown>
  }

  const result = await upsertParticipantVotes({
    pollId,
    fullName: payload.fullName ?? "",
    authUserId: user?.id,
    votes: payload.votes ?? {},
  })

  if (result.errors) {
    const status = result.errors.includes("Poll not found") ? 404 : 400
    return NextResponse.json({ errors: result.errors }, { status })
  }

  const response = NextResponse.json({ poll: result.poll }, { status: 200 })
  setVotedPollCookie({
    response,
    existingCookieValue: request.cookies.get(VOTED_POLLS_COOKIE)?.value,
    pollId,
  })

  return response
}
