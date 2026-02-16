import { notFound } from "next/navigation"

import { PollResultsView } from "@/components/date-poll/PollResultsView"
import { getPoll } from "@/lib/date-poll/store"

export default async function PollResultsPage({
  params,
}: {
  params: Promise<{ pollId: string }>
}) {
  const { pollId } = await params
  const poll = getPoll(pollId)

  if (!poll) {
    notFound()
  }

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{poll.title}</h1>
          {poll.description ? (
            <p className="text-muted-foreground text-sm">{poll.description}</p>
          ) : null}
        </div>

        <PollResultsView poll={poll} />
      </div>
    </main>
  )
}
