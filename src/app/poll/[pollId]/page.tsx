import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { PollClientPage } from "@/components/date-poll/PollClientPage"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { GUEST_PARTICIPANT_COOKIE, parseGuestToken } from "@/lib/date-poll/guest-cookie"
import {
  getParticipantVotesForGuest,
  getParticipantVotesForUser,
  getPoll,
  isPollOrganizer,
} from "@/lib/date-poll/store"

export const dynamic = "force-dynamic"

function mapPollError(error: string | undefined): string | null {
  if (error === "vote_required") {
    return "Submit your vote first to view results."
  }

  return null
}

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ pollId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { pollId } = await params
  const query = await searchParams
  const poll = await getPoll(pollId)

  if (!poll) {
    notFound()
  }

  const cookieStore = await cookies()
  const currentUser = await getCurrentUserFromCookies(cookieStore)
  const guestToken = parseGuestToken(cookieStore.get(GUEST_PARTICIPANT_COOKIE)?.value)
  const [existingVote, isOrganizer, guestVote] = await Promise.all([
    currentUser ? getParticipantVotesForUser({ pollId, userId: currentUser.id }) : Promise.resolve(null),
    currentUser ? isPollOrganizer({ pollId, userId: currentUser.id }) : Promise.resolve(false),
    !currentUser && guestToken
      ? getParticipantVotesForGuest({ pollId, guestToken })
      : Promise.resolve(null),
  ])
  const canViewResults = isOrganizer || existingVote !== null || guestVote !== null

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <PollClientPage
          initialPoll={poll}
          initialFullName={currentUser?.fullName ?? existingVote?.fullName ?? guestVote?.fullName ?? ""}
          initialVotes={existingVote?.votes ?? guestVote?.votes}
          initialCanViewResults={canViewResults}
          initialError={mapPollError(query.error)}
        />
      </div>
    </main>
  )
}
