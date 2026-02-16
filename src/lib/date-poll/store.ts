import { randomUUID } from "node:crypto"

import type { AccountPollSummary } from "@/lib/date-poll/account-polls"
import { type PollCreateInput, type PollView, type VoteStatus } from "@/lib/date-poll/types"
import {
  normalizeParticipantName,
  validateCreatePollInput,
  validateVotePayload,
} from "@/lib/date-poll/validation"

type DbVoteStatus = "CAN" | "MAYBE" | "CANT"

type PollRow = {
  id: string
  title: string
  description: string | null
  timezone: string
  creatorUserId: string | null
  createdAt: string
}

type PollOptionRow = {
  id: string
  pollId: string
  value: string
  position: number
}

type ParticipantRow = {
  id: string
  pollId: string
  fullName: string
  normalizedName: string
  authUserId: string | null
  updatedAt: string
}

type VoteRow = {
  pollOptionId: string
  participantId: string
  status: DbVoteStatus
}

type SupabaseDbResponse<T> =
  | {
      data: T
      error: null
    }
  | {
      data: null
      error: string
    }

type PollRecord = {
  poll: PollRow
  options: PollOptionRow[]
  participants: ParticipantRow[]
  votes: VoteRow[]
}

const MISSING_TABLE_IN_SCHEMA_CACHE_RE =
  /Could not find the table 'public\.[^']+' in the schema cache/i

function getSupabaseDbConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey) {
    return null
  }

  return {
    url,
    apiKey: serviceRoleKey ?? anonKey,
  }
}

function parseDbError(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Database request failed"
  }

  const candidate = payload as {
    message?: string
    error?: string
    details?: string
    hint?: string
  }

  return (
    candidate.message ??
    candidate.error ??
    candidate.details ??
    candidate.hint ??
    "Database request failed"
  )
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function supabaseDbFetch<T>(path: string, init: RequestInit): Promise<SupabaseDbResponse<T>> {
  const config = getSupabaseDbConfig()
  if (!config) {
    return { data: null, error: "Supabase database is not configured" }
  }

  const headers: Record<string, string> = {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers ? (init.headers as Record<string, string>) : {}),
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers,
      cache: "no-store",
    })

    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      return { data: null, error: parseDbError(payload) }
    }

    return {
      data: payload as T,
      error: null,
    }
  } catch {
    return { data: null, error: "Unable to reach Supabase database" }
  }
}

function throwIfDbError<T>(result: SupabaseDbResponse<T>): T {
  if (result.error !== null) {
    if (MISSING_TABLE_IN_SCHEMA_CACHE_RE.test(result.error)) {
      throw new Error(
        `${result.error}. Run sql/migrations/001_init_poll_schema.sql in Supabase SQL Editor, then run: NOTIFY pgrst, 'reload schema';`
      )
    }

    throw new Error(result.error)
  }

  if (result.data === null) {
    throw new Error("Database request failed")
  }

  return result.data
}

function isMissingSchemaCacheTableError(error: unknown): boolean {
  return error instanceof Error && MISSING_TABLE_IN_SCHEMA_CACHE_RE.test(error.message)
}

function asInFilter(values: string[]): string {
  const escaped = values.map((value) => `"${value.replaceAll('"', '\\"')}"`)
  return `in.(${escaped.join(",")})`
}

function voteStatusToDbStatus(status: VoteStatus): DbVoteStatus {
  if (status === "can") return "CAN"
  if (status === "maybe") return "MAYBE"
  return "CANT"
}

function dbStatusToVoteStatus(status: DbVoteStatus): VoteStatus {
  if (status === "CAN") return "can"
  if (status === "MAYBE") return "maybe"
  return "cant"
}

function toOptionValueString(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return parsedDate.toISOString().slice(0, 10)
}

function mapToView(record: PollRecord): PollView {
  const optionStats = record.options.map((option) => ({
    id: option.id,
    value: toOptionValueString(option.value),
    canCount: 0,
    maybeCount: 0,
    cantCount: 0,
  }))

  const optionById = new Map(optionStats.map((option) => [option.id, option]))
  const participantVotes = new Map<string, Record<string, VoteStatus>>()

  for (const participant of record.participants) {
    participantVotes.set(participant.id, {})
  }

  for (const vote of record.votes) {
    const status = dbStatusToVoteStatus(vote.status)

    const option = optionById.get(vote.pollOptionId)
    if (option) {
      if (status === "can") option.canCount += 1
      if (status === "maybe") option.maybeCount += 1
      if (status === "cant") option.cantCount += 1
    }

    const votes = participantVotes.get(vote.participantId)
    if (votes) {
      votes[vote.pollOptionId] = status
    }
  }

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
    id: record.poll.id,
    title: record.poll.title,
    description: record.poll.description ?? undefined,
    timezone: record.poll.timezone,
    createdAt: new Date(record.poll.createdAt).toISOString(),
    options: optionStats,
    participants: record.participants
      .map((participant) => ({
        id: participant.id,
        fullName: participant.fullName,
        votes: participantVotes.get(participant.id) ?? {},
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  }
}

async function getPollRecord(pollId: string): Promise<PollRecord | null> {
  const pollParams = new URLSearchParams({
    select: "id,title,description,timezone,creatorUserId,createdAt",
    id: `eq.${pollId}`,
    limit: "1",
  })

  const pollResult = await supabaseDbFetch<PollRow[]>(`Poll?${pollParams.toString()}`, {
    method: "GET",
  })

  const pollRows = throwIfDbError(pollResult)
  const poll = pollRows[0]

  if (!poll) {
    return null
  }

  const optionParams = new URLSearchParams({
    select: "id,pollId,value,position",
    pollId: `eq.${pollId}`,
    order: "position.asc",
  })

  const participantParams = new URLSearchParams({
    select: "id,pollId,fullName,normalizedName,authUserId,updatedAt",
    pollId: `eq.${pollId}`,
    order: "fullName.asc",
  })

  const [optionsResult, participantsResult] = await Promise.all([
    supabaseDbFetch<PollOptionRow[]>(`PollOption?${optionParams.toString()}`, {
      method: "GET",
    }),
    supabaseDbFetch<ParticipantRow[]>(`Participant?${participantParams.toString()}`, {
      method: "GET",
    }),
  ])

  const options = throwIfDbError(optionsResult)
  const participants = throwIfDbError(participantsResult)

  let votes: VoteRow[] = []

  if (participants.length > 0) {
    const voteParams = new URLSearchParams({
      select: "pollOptionId,participantId,status",
      participantId: asInFilter(participants.map((participant) => participant.id)),
    })

    const votesResult = await supabaseDbFetch<VoteRow[]>(`Vote?${voteParams.toString()}`, {
      method: "GET",
    })

    votes = throwIfDbError(votesResult)
  }

  return {
    poll,
    options,
    participants,
    votes,
  }
}

export async function createPoll(
  input: PollCreateInput
): Promise<{ poll?: PollView; errors?: string[] }> {
  const cleanedInput: PollCreateInput = {
    title: input.title.trim(),
    description: input.description?.trim(),
    timezone: input.timezone.trim() || "Europe/Vienna",
    options: input.options,
    creatorUserId: input.creatorUserId,
  }

  const errors = validateCreatePollInput(cleanedInput)
  if (errors.length > 0) {
    return { errors }
  }

  const now = new Date().toISOString()
  const pollId = randomUUID()

  const pollInsertResult = await supabaseDbFetch<PollRow[]>("Poll", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: pollId,
      title: cleanedInput.title,
      description: cleanedInput.description || null,
      timezone: cleanedInput.timezone,
      creatorUserId: cleanedInput.creatorUserId || null,
      createdAt: now,
      updatedAt: now,
    }),
  })

  if (pollInsertResult.error) {
    return { errors: ["Could not create poll"] }
  }

  const optionsPayload = cleanedInput.options.map((value, position) => ({
    id: randomUUID(),
    pollId,
    value: new Date(value).toISOString(),
    position,
  }))

  const optionInsertResult = await supabaseDbFetch<PollOptionRow[]>("PollOption", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(optionsPayload),
  })

  if (optionInsertResult.error) {
    const cleanupParams = new URLSearchParams({
      id: `eq.${pollId}`,
    })

    await supabaseDbFetch<unknown>(`Poll?${cleanupParams.toString()}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    })

    return { errors: ["Could not create poll"] }
  }

  try {
    const poll = await getPoll(pollId)
    if (!poll) {
      return { errors: ["Could not create poll"] }
    }

    return { poll }
  } catch {
    return { errors: ["Could not create poll"] }
  }
}

export async function getPoll(pollId: string): Promise<PollView | null> {
  const record = await getPollRecord(pollId)
  if (!record) return null

  return mapToView(record)
}

export async function hasUserVotedOnPoll(args: {
  pollId: string
  userId: string
}): Promise<boolean> {
  const params = new URLSearchParams({
    select: "id",
    pollId: `eq.${args.pollId}`,
    authUserId: `eq.${args.userId}`,
    limit: "1",
  })

  const result = await supabaseDbFetch<Array<{ id: string }>>(
    `Participant?${params.toString()}`,
    {
      method: "GET",
    }
  )

  const rows = throwIfDbError(result)
  return rows.length > 0
}

export async function getParticipantVotesForUser(args: {
  pollId: string
  userId: string
}): Promise<{ fullName: string; votes: Record<string, VoteStatus> } | null> {
  const participantParams = new URLSearchParams({
    select: "id,fullName",
    pollId: `eq.${args.pollId}`,
    authUserId: `eq.${args.userId}`,
    limit: "1",
  })

  const participantResult = await supabaseDbFetch<Array<{ id: string; fullName: string }>>(
    `Participant?${participantParams.toString()}`,
    { method: "GET" }
  )

  const participantRows = throwIfDbError(participantResult)
  const participant = participantRows[0]

  if (!participant) {
    return null
  }

  const voteParams = new URLSearchParams({
    select: "pollOptionId,status",
    participantId: `eq.${participant.id}`,
  })

  const voteResult = await supabaseDbFetch<Array<{ pollOptionId: string; status: DbVoteStatus }>>(
    `Vote?${voteParams.toString()}`,
    { method: "GET" }
  )

  const voteRows = throwIfDbError(voteResult)
  const votes: Record<string, VoteStatus> = {}

  for (const voteRow of voteRows) {
    votes[voteRow.pollOptionId] = dbStatusToVoteStatus(voteRow.status)
  }

  return {
    fullName: participant.fullName,
    votes,
  }
}

export async function upsertParticipantVotes(args: {
  pollId: string
  fullName: string
  authUserId?: string
  votes: Record<string, unknown>
}): Promise<{ poll?: PollView; errors?: string[] }> {
  const pollParams = new URLSearchParams({
    select: "id",
    id: `eq.${args.pollId}`,
    limit: "1",
  })

  const [pollResult, optionsResult, participantsResult] = await Promise.all([
    supabaseDbFetch<Array<{ id: string }>>(`Poll?${pollParams.toString()}`, { method: "GET" }),
    supabaseDbFetch<PollOptionRow[]>(
      `PollOption?${new URLSearchParams({
        select: "id,pollId,value,position",
        pollId: `eq.${args.pollId}`,
        order: "position.asc",
      }).toString()}`,
      { method: "GET" }
    ),
    supabaseDbFetch<ParticipantRow[]>(
      `Participant?${new URLSearchParams({
        select: "id,pollId,fullName,normalizedName,authUserId,updatedAt",
        pollId: `eq.${args.pollId}`,
      }).toString()}`,
      { method: "GET" }
    ),
  ])

  if (pollResult.error || optionsResult.error || participantsResult.error) {
    return { errors: ["Could not save vote"] }
  }

  const pollRows = pollResult.data ?? []
  const optionRows = optionsResult.data ?? []
  const participantRows = participantsResult.data ?? []

  const poll = pollRows[0]
  if (!poll) {
    return { errors: ["Poll not found"] }
  }

  const optionIds = optionRows.map((option) => option.id)
  const validationErrors = validateVotePayload({
    fullName: args.fullName,
    optionIds,
    votes: args.votes,
  })

  if (validationErrors.length > 0) {
    return { errors: validationErrors }
  }

  const normalizedName = normalizeParticipantName(args.fullName)
  const existingParticipant = args.authUserId
    ? participantRows.find((participant) => participant.authUserId === args.authUserId)
    : participantRows.find((participant) => participant.normalizedName === normalizedName)

  const participantId = existingParticipant?.id ?? randomUUID()
  const now = new Date().toISOString()

  const participantMutation = existingParticipant
    ? supabaseDbFetch<ParticipantRow[]>(
        `Participant?${new URLSearchParams({ id: `eq.${existingParticipant.id}` }).toString()}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            fullName: args.fullName.trim(),
            normalizedName,
            authUserId: args.authUserId ?? existingParticipant.authUserId ?? null,
            updatedAt: now,
          }),
        }
      )
    : supabaseDbFetch<ParticipantRow[]>("Participant", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: participantId,
          pollId: poll.id,
          fullName: args.fullName.trim(),
          normalizedName,
          authUserId: args.authUserId ?? null,
          createdAt: now,
          updatedAt: now,
        }),
      })

  const participantMutationResult = await participantMutation

  if (participantMutationResult.error) {
    return { errors: ["Could not save vote"] }
  }

  const deleteVotesResult = await supabaseDbFetch<VoteRow[]>(
    `Vote?${new URLSearchParams({ participantId: `eq.${participantId}` }).toString()}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=representation",
      },
    }
  )

  if (deleteVotesResult.error) {
    return { errors: ["Could not save vote"] }
  }

  const votePayload = optionIds.map((optionId) => ({
    id: randomUUID(),
    pollOptionId: optionId,
    participantId,
    status: voteStatusToDbStatus(args.votes[optionId] as VoteStatus),
  }))

  const insertVotesResult = await supabaseDbFetch<VoteRow[]>("Vote", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(votePayload),
  })

  if (insertVotesResult.error) {
    return { errors: ["Could not save vote"] }
  }

  try {
    const updatedPoll = await getPoll(args.pollId)
    if (!updatedPoll) {
      return { errors: ["Poll not found"] }
    }

    return { poll: updatedPoll }
  } catch {
    return { errors: ["Could not save vote"] }
  }
}

export async function getPollSummariesForUser(userId: string): Promise<AccountPollSummary[]> {
  try {
    const [ownedPollsResult, joinedPollRowsResult] = await Promise.all([
      supabaseDbFetch<PollRow[]>(
        `Poll?${new URLSearchParams({
          select: "id,title,creatorUserId,createdAt",
          creatorUserId: `eq.${userId}`,
        }).toString()}`,
        {
          method: "GET",
        }
      ),
      supabaseDbFetch<Array<{ pollId: string; updatedAt: string }>>(
        `Participant?${new URLSearchParams({
          select: "pollId,updatedAt",
          authUserId: `eq.${userId}`,
          order: "updatedAt.desc",
        }).toString()}`,
        {
          method: "GET",
        }
      ),
    ])

    const ownedPolls = throwIfDbError(ownedPollsResult)
    const joinedPollRows = throwIfDbError(joinedPollRowsResult)

    const joinedPollIds = [...new Set(joinedPollRows.map((row) => row.pollId))]

    let joinedPolls: PollRow[] = []
    if (joinedPollIds.length > 0) {
      const joinedPollParams = new URLSearchParams({
        select: "id,title,creatorUserId,createdAt",
        id: asInFilter(joinedPollIds),
      })

      const joinedPollsResult = await supabaseDbFetch<PollRow[]>(
        `Poll?${joinedPollParams.toString()}`,
        {
          method: "GET",
        }
      )

      joinedPolls = throwIfDbError(joinedPollsResult)
    }

    const joinedPollById = new Map(joinedPolls.map((poll) => [poll.id, poll]))
    const summaryByPollId = new Map<string, AccountPollSummary>()

    for (const poll of ownedPolls) {
      summaryByPollId.set(poll.id, {
        id: poll.id,
        title: poll.title,
        path: `/poll/${poll.id}`,
        role: "organizer",
        lastInteractionAt: new Date(poll.createdAt).toISOString(),
      })
    }

    for (const joinedRow of joinedPollRows) {
      const poll = joinedPollById.get(joinedRow.pollId)
      if (!poll) continue

      const existing = summaryByPollId.get(poll.id)
      const participantUpdatedAt = new Date(joinedRow.updatedAt).toISOString()

      if (!existing) {
        summaryByPollId.set(poll.id, {
          id: poll.id,
          title: poll.title,
          path: `/poll/${poll.id}`,
          role: poll.creatorUserId === userId ? "organizer" : "participant",
          lastInteractionAt: participantUpdatedAt,
        })
        continue
      }

      if (Date.parse(participantUpdatedAt) > Date.parse(existing.lastInteractionAt)) {
        summaryByPollId.set(poll.id, {
          ...existing,
          lastInteractionAt: participantUpdatedAt,
        })
      }
    }

    return [...summaryByPollId.values()].sort(
      (a, b) => Date.parse(b.lastInteractionAt) - Date.parse(a.lastInteractionAt)
    )
  } catch (error) {
    if (isMissingSchemaCacheTableError(error)) {
      console.error(
        "Supabase poll tables are missing from PostgREST schema cache. Run sql/migrations/001_init_poll_schema.sql and then NOTIFY pgrst, 'reload schema';"
      )
      return []
    }

    throw error
  }
}

export async function leavePollForUser(args: {
  pollId: string
  userId: string
}): Promise<boolean> {
  const pollResult = await supabaseDbFetch<Array<{ creatorUserId: string | null }>>(
    `Poll?${new URLSearchParams({
      select: "creatorUserId",
      id: `eq.${args.pollId}`,
      limit: "1",
    }).toString()}`,
    { method: "GET" }
  )

  const pollRows = throwIfDbError(pollResult)
  const poll = pollRows[0]

  if (!poll) return false

  if (poll.creatorUserId === args.userId) {
    const deletePollResult = await supabaseDbFetch<Array<{ id: string }>>(
      `Poll?${new URLSearchParams({
        id: `eq.${args.pollId}`,
      }).toString()}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=representation",
        },
      }
    )

    const deletedRows = throwIfDbError(deletePollResult)
    return deletedRows.length > 0
  }

  const deleteParticipantResult = await supabaseDbFetch<Array<{ id: string }>>(
    `Participant?${new URLSearchParams({
      pollId: `eq.${args.pollId}`,
      authUserId: `eq.${args.userId}`,
    }).toString()}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=representation",
      },
    }
  )

  const deletedRows = throwIfDbError(deleteParticipantResult)
  return deletedRows.length > 0
}

export async function leaveAllPollsForUser(userId: string): Promise<number> {
  const [ownedPollsResult, joinedPollsResult] = await Promise.all([
    supabaseDbFetch<Array<{ id: string }>>(
      `Poll?${new URLSearchParams({
        select: "id",
        creatorUserId: `eq.${userId}`,
      }).toString()}`,
      { method: "GET" }
    ),
    supabaseDbFetch<Array<{ pollId: string }>>(
      `Participant?${new URLSearchParams({
        select: "pollId",
        authUserId: `eq.${userId}`,
      }).toString()}`,
      { method: "GET" }
    ),
  ])

  const ownedPolls = throwIfDbError(ownedPollsResult)
  const joinedPolls = throwIfDbError(joinedPollsResult)

  const changedPollIds = new Set<string>()

  for (const poll of ownedPolls) {
    changedPollIds.add(poll.id)
  }

  for (const poll of joinedPolls) {
    changedPollIds.add(poll.pollId)
  }

  const deleteParticipantsResult = await supabaseDbFetch<unknown>(
    `Participant?${new URLSearchParams({
      authUserId: `eq.${userId}`,
    }).toString()}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  )

  if (deleteParticipantsResult.error) {
    throw new Error(deleteParticipantsResult.error)
  }

  const deletePollsResult = await supabaseDbFetch<unknown>(
    `Poll?${new URLSearchParams({
      creatorUserId: `eq.${userId}`,
    }).toString()}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  )

  if (deletePollsResult.error) {
    throw new Error(deletePollsResult.error)
  }

  return changedPollIds.size
}
