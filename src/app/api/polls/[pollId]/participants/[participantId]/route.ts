import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { removeParticipantVotesAsOrganizer } from "@/lib/date-poll/store"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pollId: string; participantId: string }> }
) {
  const user = await getCurrentUserFromCookies(request.cookies)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { pollId, participantId } = await context.params

  try {
    const result = await removeParticipantVotesAsOrganizer({
      pollId,
      participantId,
      organizerUserId: user.id,
    })

    if (result.errors) {
      const status = result.errors.includes("Not allowed")
        ? 403
        : result.errors.includes("Poll not found") || result.errors.includes("Vote not found")
          ? 404
          : 400

      return NextResponse.json({ errors: result.errors }, { status })
    }

    return NextResponse.json({ poll: result.poll }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Could not remove votes" }, { status: 500 })
  }
}
