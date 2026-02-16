import type { TrackedPoll } from "@/lib/date-poll/tracked-polls"

export type AccountPollSummary = {
  id: string
  title: string
  path: string
  role: "organizer" | "participant"
  lastInteractionAt: string
}

function toTrackedSummary(poll: TrackedPoll): AccountPollSummary {
  return {
    id: poll.id,
    title: poll.title,
    path: poll.path,
    role: poll.organizer ? "organizer" : "participant",
    lastInteractionAt: poll.lastInteractionAt,
  }
}

export function mergeAccountAndTrackedPolls(args: {
  accountPolls: AccountPollSummary[]
  trackedPolls: TrackedPoll[]
}): AccountPollSummary[] {
  const byPollId = new Map<string, AccountPollSummary>()

  for (const poll of args.accountPolls) {
    byPollId.set(poll.id, poll)
  }

  for (const trackedPoll of args.trackedPolls) {
    const trackedSummary = toTrackedSummary(trackedPoll)
    const existing = byPollId.get(trackedSummary.id)

    if (!existing) {
      byPollId.set(trackedSummary.id, trackedSummary)
      continue
    }

    const existingActivity = Date.parse(existing.lastInteractionAt)
    const trackedActivity = Date.parse(trackedSummary.lastInteractionAt)

    byPollId.set(trackedSummary.id, {
      ...existing,
      title: existing.title || trackedSummary.title,
      path: existing.path || trackedSummary.path,
      role:
        existing.role === "organizer" || trackedSummary.role === "organizer"
          ? "organizer"
          : "participant",
      lastInteractionAt:
        !Number.isNaN(trackedActivity) &&
        (Number.isNaN(existingActivity) || trackedActivity > existingActivity)
          ? trackedSummary.lastInteractionAt
          : existing.lastInteractionAt,
    })
  }

  return [...byPollId.values()].sort(
    (a, b) => Date.parse(b.lastInteractionAt) - Date.parse(a.lastInteractionAt)
  )
}
