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

  return NextResponse.json({ polls: getPollSummariesForUser(user.id) })
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromCookies(request.cookies)

  if (!user) {
    return NextResponse.json({ polls: [] }, { status: 401 })
  }

  const pollId = new URL(request.url).searchParams.get("pollId")?.trim()

  if (pollId) {
    leavePollForUser({ pollId, userId: user.id })
  } else {
    leaveAllPollsForUser(user.id)
  }

  return NextResponse.json({ polls: getPollSummariesForUser(user.id) })
}
