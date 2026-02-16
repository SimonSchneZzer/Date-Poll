import { randomUUID } from "node:crypto"

import {
  normalizeParticipantName,
  validateCreatePollInput,
  validateVotePayload,
} from "@/lib/date-poll/validation"
import type { AccountPollSummary } from "@/lib/date-poll/account-polls"
import { type PollCreateInput, type PollView, type VoteStatus } from "@/lib/date-poll/types"

type PollRecord = {
  id: string
  title: string
  description?: string
  timezone: string
  creatorUserId?: string
  createdAt: string
  options: { id: string; value: string }[]
  participants: {
    id: string
    fullName: string
    normalizedName: string
    authUserId?: string
    updatedAt: string
    votes: Record<string, VoteStatus>
  }[]
}

type PollStore = Map<string, PollRecord>

declare global {
  var __datePollStore__: PollStore | undefined
}

function getStore(): PollStore {
  if (!globalThis.__datePollStore__) {
    globalThis.__datePollStore__ = new Map<string, PollRecord>()
  }

  return globalThis.__datePollStore__
}

export function createPoll(input: PollCreateInput): { poll?: PollView; errors?: string[] } {
  const cleanedInput: PollCreateInput = {
    title: input.title.trim(),
    description: input.description?.trim(),
    timezone: input.timezone.trim() || "Europe/Vienna",
    options: input.options,
  }

  const errors = validateCreatePollInput(cleanedInput)
  if (errors.length > 0) {
    return { errors }
  }

  const pollId = randomUUID()
  const record: PollRecord = {
    id: pollId,
    title: cleanedInput.title,
    description: cleanedInput.description || undefined,
    timezone: cleanedInput.timezone,
    creatorUserId: input.creatorUserId,
    createdAt: new Date().toISOString(),
    options: cleanedInput.options.map((value) => ({ id: randomUUID(), value })),
    participants: [],
  }

  getStore().set(record.id, record)

  return { poll: mapToView(record) }
}

export function getPoll(pollId: string): PollView | null {
  const poll = getStore().get(pollId)
  return poll ? mapToView(poll) : null
}

export function hasUserVotedOnPoll(args: { pollId: string; userId: string }): boolean {
  const poll = getStore().get(args.pollId)
  if (!poll) return false

  return poll.participants.some((participant) => participant.authUserId === args.userId)
}

export function upsertParticipantVotes(args: {
  pollId: string
  fullName: string
  authUserId?: string
  votes: Record<string, unknown>
}): { poll?: PollView; errors?: string[] } {
  const poll = getStore().get(args.pollId)
  if (!poll) {
    return { errors: ["Poll not found"] }
  }

  const errors = validateVotePayload({
    fullName: args.fullName,
    optionIds: poll.options.map((option) => option.id),
    votes: args.votes,
  })

  if (errors.length > 0) {
    return { errors }
  }

  const normalizedName = normalizeParticipantName(args.fullName)
  const existing = args.authUserId
    ? poll.participants.find((participant) => participant.authUserId === args.authUserId)
    : poll.participants.find((participant) => participant.normalizedName === normalizedName)

  const normalizedVotes: Record<string, VoteStatus> = {}
  for (const option of poll.options) {
    normalizedVotes[option.id] = args.votes[option.id] as VoteStatus
  }

  if (existing) {
    existing.fullName = args.fullName.trim()
    existing.normalizedName = normalizedName
    existing.authUserId = args.authUserId ?? existing.authUserId
    existing.updatedAt = new Date().toISOString()
    existing.votes = normalizedVotes
  } else {
    poll.participants.push({
      id: randomUUID(),
      fullName: args.fullName.trim(),
      normalizedName,
      authUserId: args.authUserId,
      updatedAt: new Date().toISOString(),
      votes: normalizedVotes,
    })
  }

  return { poll: mapToView(poll) }
}

export function getPollSummariesForUser(userId: string): AccountPollSummary[] {
  const summaries: AccountPollSummary[] = []

  for (const poll of getStore().values()) {
    const participant = poll.participants.find((entry) => entry.authUserId === userId)
    const isOrganizer = poll.creatorUserId === userId

    if (!participant && !isOrganizer) {
      continue
    }

    summaries.push({
      id: poll.id,
      title: poll.title,
      path: `/poll/${poll.id}`,
      role: isOrganizer ? "organizer" : "participant",
      lastInteractionAt: participant?.updatedAt ?? poll.createdAt,
    })
  }

  return summaries.sort(
    (a, b) => Date.parse(b.lastInteractionAt) - Date.parse(a.lastInteractionAt)
  )
}

export function leavePollForUser(args: { pollId: string; userId: string }): boolean {
  const poll = getStore().get(args.pollId)
  if (!poll) return false

  if (poll.creatorUserId === args.userId) {
    return getStore().delete(args.pollId)
  }

  const previousParticipantCount = poll.participants.length
  poll.participants = poll.participants.filter(
    (participant) => participant.authUserId !== args.userId
  )

  return poll.participants.length !== previousParticipantCount
}

export function leaveAllPollsForUser(userId: string): number {
  let changedCount = 0

  for (const pollId of Array.from(getStore().keys())) {
    const didLeave = leavePollForUser({ pollId, userId })
    if (didLeave) {
      changedCount += 1
    }
  }

  return changedCount
}

function mapToView(poll: PollRecord): PollView {
  const optionStats = poll.options.map((option) => {
    let canCount = 0
    let maybeCount = 0
    let cantCount = 0

    for (const participant of poll.participants) {
      const vote = participant.votes[option.id]
      if (vote === "can") canCount += 1
      if (vote === "maybe") maybeCount += 1
      if (vote === "cant") cantCount += 1
    }

    return {
      ...option,
      canCount,
      maybeCount,
      cantCount,
    }
  })

  optionStats.sort((a, b) => {
    const timeA = Date.parse(a.value)
    const timeB = Date.parse(b.value)
    const aIsValid = !Number.isNaN(timeA)
    const bIsValid = !Number.isNaN(timeB)

    if (aIsValid && bIsValid) return timeA - timeB
    if (aIsValid) return -1
    if (bIsValid) return 1
    return a.value.localeCompare(b.value)
  })

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    timezone: poll.timezone,
    createdAt: poll.createdAt,
    options: optionStats,
    participants: poll.participants
      .map((participant) => ({
        id: participant.id,
        fullName: participant.fullName,
        votes: participant.votes,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  }
}
