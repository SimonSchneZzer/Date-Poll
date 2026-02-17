import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import {
  getPollSummariesForUser,
  leaveAllPollsForUser,
  leavePollForUser,
} from "@/lib/date-poll/store"

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromCookies(request.cookies)

  if (!user) {
    return NextResponse.json({ polls: [] }, { status: 401 })
  }

  const polls = await getPollSummariesForUser(user.id)
  return NextResponse.json({ polls })
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromCookies(request.cookies)

  if (!user) {
    return NextResponse.json({ polls: [] }, { status: 401 })
  }

  const pollId = new URL(request.url).searchParams.get("pollId")?.trim()

  try {
    if (pollId) {
      const removed = await leavePollForUser({ pollId, userId: user.id })
      if (!removed) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 })
      }
    } else {
      await leaveAllPollsForUser(user.id)
    }

    const polls = await getPollSummariesForUser(user.id)
    return NextResponse.json({ polls })
  } catch {
    return NextResponse.json({ error: "Could not update poll membership" }, { status: 500 })
  }
}
