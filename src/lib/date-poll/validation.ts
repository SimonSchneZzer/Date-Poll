import { VOTE_STATUSES, type PollCreateInput, type VoteStatus } from "@/lib/date-poll/types"

const MIN_OPTIONS = 2

export function parseOptionsInput(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function validateCreatePollInput(input: PollCreateInput): string[] {
  const errors: string[] = []

  if (!input.title.trim()) {
    errors.push("Title is required")
  }

  if (input.options.length < MIN_OPTIONS) {
    errors.push("At least two date options are required")
  }

  const invalidDate = input.options.find((option) => Number.isNaN(Date.parse(option)))
  if (invalidDate) {
    errors.push(`Invalid date option: ${invalidDate}`)
  }

  return errors
}

export function normalizeParticipantName(fullName: string): string {
  return fullName
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
}

export function validateVotePayload(args: {
  fullName: string
  optionIds: string[]
  votes: Record<string, unknown>
}): string[] {
  const errors: string[] = []

  if (!args.fullName.trim()) {
    errors.push("Full name is required")
  }

  for (const optionId of args.optionIds) {
    const status = args.votes[optionId]
    if (!status || typeof status !== "string" || !VOTE_STATUSES.includes(status as VoteStatus)) {
      errors.push(`Missing or invalid vote for option ${optionId}`)
    }
  }

  return errors
}
