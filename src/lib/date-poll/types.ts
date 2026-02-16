export const VOTE_STATUSES = ["can", "maybe", "cant"] as const

export type VoteStatus = (typeof VOTE_STATUSES)[number]

export type PollOption = {
  id: string
  value: string
}

export type PollCreateInput = {
  title: string
  description?: string
  timezone: string
  options: string[]
  creatorUserId?: string
}

export type PollViewOption = PollOption & {
  canCount: number
  maybeCount: number
  cantCount: number
}

export type PollViewParticipant = {
  id: string
  fullName: string
  votes: Record<string, VoteStatus>
}

export type PollView = {
  id: string
  title: string
  description?: string
  timezone: string
  createdAt: string
  options: PollViewOption[]
  participants: PollViewParticipant[]
}
