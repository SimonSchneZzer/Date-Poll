import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { PollClientPage } from "@/components/date-poll/PollClientPage"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { hasVotedInPoll, VOTED_POLLS_COOKIE } from "@/lib/date-poll/vote-cookie"
import { getParticipantVotesForUser, getPoll, isPollOrganizer } from "@/lib/date-poll/store"

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
  const [existingVote, isOrganizer] = currentUser
    ? await Promise.all([
        getParticipantVotesForUser({ pollId, userId: currentUser.id }),
        isPollOrganizer({ pollId, userId: currentUser.id }),
      ])
    : [null, false]
  const guestHasVoted = hasVotedInPoll(cookieStore.get(VOTED_POLLS_COOKIE)?.value, pollId)
  const canViewResults = isOrganizer || existingVote !== null || guestHasVoted

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <PollClientPage
          initialPoll={poll}
          initialFullName={currentUser?.fullName ?? existingVote?.fullName ?? ""}
          initialVotes={existingVote?.votes}
          initialCanViewResults={canViewResults}
          initialError={mapPollError(query.error)}
        />
      </div>
    </main>
  )
}
