import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { PollClientPage } from "@/components/date-poll/PollClientPage"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { getPoll, hasUserVotedOnPoll } from "@/lib/date-poll/store"
import { hasVotedInPoll, VOTED_POLLS_COOKIE } from "@/lib/date-poll/vote-cookie"

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
  const votedFromBrowser = hasVotedInPoll(cookieStore.get(VOTED_POLLS_COOKIE)?.value, pollId)
  const votedFromAccount =
    currentUser ? await hasUserVotedOnPoll({ pollId, userId: currentUser.id }) : false

  if (votedFromBrowser || votedFromAccount) {
    redirect(`/poll/${pollId}/results`)
  }

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <PollClientPage initialPoll={poll} />
      </div>
    </main>
  )
}
