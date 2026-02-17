import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { PollClientPage } from "@/components/date-poll/PollClientPage"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { getParticipantVotesForUser, getPoll } from "@/lib/date-poll/store"

export const dynamic = "force-dynamic"

export default async function PollPage({
  params,
}: {
  params: Promise<{ pollId: string }>
}) {
  const { pollId } = await params
  const poll = await getPoll(pollId)

  if (!poll) {
    notFound()
  }

  const cookieStore = await cookies()
  const currentUser = await getCurrentUserFromCookies(cookieStore)
  const existingVote = currentUser
    ? await getParticipantVotesForUser({ pollId, userId: currentUser.id })
    : null

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <PollClientPage
          initialPoll={poll}
          initialFullName={currentUser?.fullName ?? existingVote?.fullName ?? ""}
          initialVotes={existingVote?.votes}
        />
      </div>
    </main>
  )
}
