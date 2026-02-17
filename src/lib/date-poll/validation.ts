import { VOTE_STATUSES, type PollCreateInput, type VoteStatus } from "@/lib/date-poll/types"

export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 120
export const MAX_POLL_TITLE_LENGTH = 140
export const MAX_POLL_DESCRIPTION_LENGTH = 2000
export const MAX_PARTICIPANT_NAME_LENGTH = 120

export function parseOptionsInput(raw: string): string[] {
  return raw
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function validateCreatePollInput(input: PollCreateInput): string[] {
  const errors: string[] = []
  const title = input.title.trim()

  if (!title) {
    errors.push("Title is required")
  }

  if (title.length > MAX_POLL_TITLE_LENGTH) {
    errors.push(`Title must be ${MAX_POLL_TITLE_LENGTH} characters or fewer`)
  }

  if (input.description && input.description.trim().length > MAX_POLL_DESCRIPTION_LENGTH) {
    errors.push(`Description must be ${MAX_POLL_DESCRIPTION_LENGTH} characters or fewer`)
  }

  if (input.options.length < MIN_POLL_OPTIONS) {
    errors.push("At least two date options are required")
  }

  if (input.options.length > MAX_POLL_OPTIONS) {
    errors.push(`Select no more than ${MAX_POLL_OPTIONS} date options`)
  }

  const seenTimestamps = new Set<number>()
  let hasDuplicateOptions = false

  for (const option of input.options) {
    const timestamp = Date.parse(option)
    if (Number.isNaN(timestamp)) {
      errors.push(`Invalid date option: ${option}`)
      continue
    }

    if (seenTimestamps.has(timestamp)) {
      hasDuplicateOptions = true
      continue
    }

    seenTimestamps.add(timestamp)
  }

  if (hasDuplicateOptions) {
    errors.push("Date options must be unique")
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
  const fullName = args.fullName.trim()

  if (!fullName) {
    errors.push("Full name is required")
  } else if (fullName.length > MAX_PARTICIPANT_NAME_LENGTH) {
    errors.push(`Full name must be ${MAX_PARTICIPANT_NAME_LENGTH} characters or fewer`)
  }

  for (const optionId of args.optionIds) {
    const status = args.votes[optionId]
    if (!status || typeof status !== "string" || !VOTE_STATUSES.includes(status as VoteStatus)) {
      errors.push(`Missing or invalid vote for option ${optionId}`)
    }
  }

  return errors
}
