import Link from "next/link"
import { PencilLine } from "lucide-react"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { PollResultsView } from "@/components/date-poll/PollResultsView"
import { Button } from "@/components/ui/button"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { getPoll, isPollOrganizer } from "@/lib/date-poll/store"

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
  const canManageVotes = currentUser
    ? await isPollOrganizer({ pollId, userId: currentUser.id })
    : false

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{poll.title}</h1>
            {poll.description ? (
              <p className="text-muted-foreground text-sm">{poll.description}</p>
            ) : null}
          </div>
          <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={`/poll/${poll.id}`}>
              <PencilLine className="size-4" />
              Edit your vote
            </Link>
          </Button>
        </div>

        <PollResultsView poll={poll} canManageVotes={canManageVotes} />
      </div>
    </main>
  )
}
