export type TrackedPollRole = "organizer" | "participant"

export type TrackedPoll = {
  id: string
  title: string
  path: string
  lastInteractionAt: string
  organizer: boolean
  participant: boolean
}

const STORAGE_KEY = "date-poll:tracked-polls"
const EVENT_NAME = "date-poll:tracked-polls-updated"

let cachedRawValue: string | null | undefined
let cachedSnapshot: TrackedPoll[] = []

function isBrowser() {
  return typeof window !== "undefined"
}

function safeParseTrackedPolls(value: string | null): TrackedPoll[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is TrackedPoll => {
        if (!item || typeof item !== "object") return false
        const candidate = item as Partial<TrackedPoll>
        return (
          typeof candidate.id === "string" &&
          typeof candidate.title === "string" &&
          typeof candidate.path === "string" &&
          typeof candidate.lastInteractionAt === "string" &&
          typeof candidate.organizer === "boolean" &&
          typeof candidate.participant === "boolean"
        )
      })
      .sort(sortTrackedPolls)
  } catch {
    return []
  }
}

function sortTrackedPolls(a: TrackedPoll, b: TrackedPoll) {
  if (a.participant !== b.participant) {
    return a.participant ? -1 : 1
  }

  return Date.parse(b.lastInteractionAt) - Date.parse(a.lastInteractionAt)
}

function dispatchTrackedPollsUpdate() {
  if (!isBrowser()) return
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function getTrackedPollsSnapshot(): TrackedPoll[] {
  if (!isBrowser()) return []

  const rawValue = window.localStorage.getItem(STORAGE_KEY)
  if (rawValue === cachedRawValue && cachedSnapshot) {
    return cachedSnapshot
  }

  cachedRawValue = rawValue
  cachedSnapshot = safeParseTrackedPolls(rawValue)
  return cachedSnapshot
}

export function getTrackedPollsServerSnapshot(): TrackedPoll[] {
  return []
}

export function subscribeTrackedPolls(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => {}
  }

  const handler = () => onStoreChange()

  window.addEventListener("storage", handler)
  window.addEventListener(EVENT_NAME, handler)

  return () => {
    window.removeEventListener("storage", handler)
    window.removeEventListener(EVENT_NAME, handler)
  }
}

export function upsertTrackedPoll(input: {
  id: string
  title: string
  path: string
  role: TrackedPollRole
}) {
  if (!isBrowser()) return

  const current = getTrackedPollsSnapshot()
  const index = current.findIndex((poll) => poll.id === input.id)

  if (index === -1) {
    current.push({
      id: input.id,
      title: input.title,
      path: input.path,
      lastInteractionAt: new Date().toISOString(),
      organizer: input.role === "organizer",
      participant: input.role === "participant",
    })
  } else {
    const existing = current[index]
    current[index] = {
      ...existing,
      title: input.title,
      path: input.path,
      lastInteractionAt: new Date().toISOString(),
      organizer: existing.organizer || input.role === "organizer",
      participant: existing.participant || input.role === "participant",
    }
  }

  const next = [...current].sort(sortTrackedPolls)
  const serialized = JSON.stringify(next)
  window.localStorage.setItem(STORAGE_KEY, serialized)
  cachedRawValue = serialized
  cachedSnapshot = next
  dispatchTrackedPollsUpdate()
}

export function removeTrackedPoll(pollId: string) {
  if (!isBrowser()) return

  const current = getTrackedPollsSnapshot()
  const next = current.filter((poll) => poll.id !== pollId)

  if (next.length === current.length) {
    return
  }

  const serialized = JSON.stringify(next)
  window.localStorage.setItem(STORAGE_KEY, serialized)
  cachedRawValue = serialized
  cachedSnapshot = next
  dispatchTrackedPollsUpdate()
}

export function clearTrackedPolls() {
  if (!isBrowser()) return

  window.localStorage.removeItem(STORAGE_KEY)
  cachedRawValue = null
  cachedSnapshot = []
  dispatchTrackedPollsUpdate()
}
