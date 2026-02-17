import Link from "next/link"
import { PencilLine } from "lucide-react"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { PollResultsView } from "@/components/date-poll/PollResultsView"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { getParticipantVotesForUser, getPoll, isPollOrganizer } from "@/lib/date-poll/store"
import { hasVotedInPoll, VOTED_POLLS_COOKIE } from "@/lib/date-poll/vote-cookie"

export const dynamic = "force-dynamic"

export default async function PollResultsPage({
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
  const guestHasVoted = hasVotedInPoll(cookieStore.get(VOTED_POLLS_COOKIE)?.value, pollId)
  const canViewResults = existingVote !== null || guestHasVoted

  if (!canViewResults) {
    redirect(`/poll/${pollId}?error=vote_required`)
  }

  const canManageVotes = currentUser
    ? await isPollOrganizer({ pollId, userId: currentUser.id })
    : false

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                Results
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{poll.title}</h1>
              {poll.description ? (
                <p className="text-muted-foreground max-w-2xl text-sm">{poll.description}</p>
              ) : (
                <p className="text-muted-foreground max-w-2xl text-sm">
                  Overview of participant availability for each date option.
                </p>
              )}
            </div>
            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href={`/poll/${poll.id}`}>
                <PencilLine className="size-4" />
                Edit your vote
              </Link>
            </Button>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Participants: {poll.participants.length}</Badge>
            <Badge variant="secondary">Options: {poll.options.length}</Badge>
            <Badge variant="secondary">{canManageVotes ? "Organizer view" : "Participant view"}</Badge>
          </div>
        </section>

        <PollResultsView poll={poll} canManageVotes={canManageVotes} />
      </div>
    </main>
  )
}
