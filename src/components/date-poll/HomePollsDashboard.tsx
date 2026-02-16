"use client"

import { Link2, Plus, Trash2, UserPlus, UserRound, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getCreatePollPath, normalizeNextPath, type AuthUser } from "@/lib/auth/supabase-auth"
import {
  mergeAccountAndTrackedPolls,
  type AccountPollSummary,
} from "@/lib/date-poll/account-polls"
import {
  getTrackedPollsServerSnapshot,
  getTrackedPollsSnapshot,
  removeTrackedPoll,
  subscribeTrackedPolls,
} from "@/lib/date-poll/tracked-polls"

type DashboardPoll = {
  id: string
  title: string
  path: string
  lastInteractionAt: string
  role: "organizer" | "participant"
}

function toDashboardPoll(summary: AccountPollSummary): DashboardPoll {
  return {
    id: summary.id,
    title: summary.title,
    path: summary.path,
    role: summary.role,
    lastInteractionAt: summary.lastInteractionAt,
  }
}

function parsePollPath(rawValue: string): string | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null

  let candidate = trimmed

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      candidate = new URL(trimmed).pathname
    } catch {
      return null
    }
  }

  if (candidate.startsWith("poll/")) {
    candidate = `/${candidate}`
  }

  if (candidate.startsWith("/")) {
    const match = candidate.match(/^\/poll\/([^/?#]+)/)
    if (!match) return null
    return `/poll/${match[1]}`
  }

  if (/^[A-Za-z0-9-]+$/.test(candidate)) {
    return `/poll/${candidate}`
  }

  return null
}

function formatLastSeen(isoDate: string): string {
  const value = Date.parse(isoDate)
  if (Number.isNaN(value)) return "Unknown"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function sortDashboardPolls(a: DashboardPoll, b: DashboardPoll): number {
  return Date.parse(b.lastInteractionAt) - Date.parse(a.lastInteractionAt)
}

function PollListSection({
  title,
  description,
  polls,
  emptyLabel,
  isMutatingPolls,
  onRemovePoll,
}: {
  title: string
  description: string
  polls: DashboardPoll[]
  emptyLabel: string
  isMutatingPolls: boolean
  onRemovePoll: (poll: DashboardPoll) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {polls.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
            {emptyLabel}
          </div>
        ) : (
          polls.map((poll) => (
            <div key={poll.id} className="group flex items-center gap-2">
              <Link
                href={poll.path}
                className="hover:bg-accent/50 flex min-w-0 flex-1 items-center justify-between rounded-md border px-3 py-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{poll.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Last activity: {formatLastSeen(poll.lastInteractionAt)}
                  </p>
                </div>
                <Badge variant="outline">
                  {poll.role === "organizer" ? "Created" : "Joined"}
                </Badge>
              </Link>
              <Button
                type="button"
                size="icon-xs"
                variant={poll.role === "organizer" ? "destructive" : "ghost"}
                aria-label={`${poll.role === "organizer" ? "Delete" : "Leave"} ${poll.title}`}
                disabled={isMutatingPolls}
                onClick={() => onRemovePoll(poll)}
              >
                {poll.role === "organizer" ? (
                  <Trash2 className="size-3.5" />
                ) : (
                  <X className="size-3.5" />
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export function HomePollsDashboard({
  initialUser,
  initialAccountPolls,
}: {
  initialUser: AuthUser | null
  initialAccountPolls: AccountPollSummary[]
}) {
  const router = useRouter()
  const trackedPolls = useSyncExternalStore(
    subscribeTrackedPolls,
    getTrackedPollsSnapshot,
    getTrackedPollsServerSnapshot
  )
  const [accountPolls, setAccountPolls] = useState(initialAccountPolls)
  const [joinInput, setJoinInput] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const [pendingGuestJoinPath, setPendingGuestJoinPath] = useState<string | null>(null)
  const [isMutatingPolls, setIsMutatingPolls] = useState(false)
  const createPollHref = initialUser
    ? getCreatePollPath()
    : `/login?next=${encodeURIComponent(normalizeNextPath(getCreatePollPath()))}`
  const registerHref = `/register?next=${encodeURIComponent(
    normalizeNextPath(pendingGuestJoinPath ?? "/")
  )}`

  useEffect(() => {
    setAccountPolls(initialAccountPolls)
  }, [initialAccountPolls])

  useEffect(() => {
    if (!initialUser) return

    let cancelled = false

    async function refresh() {
      try {
        const response = await fetch("/api/polls/mine", { method: "GET", cache: "no-store" })
        if (!response.ok) return

        const payload = (await response.json().catch(() => null)) as
          | { polls?: AccountPollSummary[] }
          | null

        if (cancelled) return
        if (payload?.polls && Array.isArray(payload.polls)) {
          setAccountPolls(payload.polls)
        }
      } catch {
        // Keep the current list on fetch failures.
      }
    }

    refresh()

    return () => {
      cancelled = true
    }
  }, [initialUser])

  const mergedPolls = useMemo(() => {
    if (!initialUser) return []

    return mergeAccountAndTrackedPolls({
      accountPolls,
      trackedPolls,
    })
  }, [accountPolls, initialUser, trackedPolls])

  const createdPolls = useMemo<DashboardPoll[]>(() => {
    if (initialUser) {
      return mergedPolls
        .filter((poll) => poll.role === "organizer")
        .map(toDashboardPoll)
        .sort(sortDashboardPolls)
    }

    return trackedPolls
      .filter((poll) => poll.organizer)
      .map((poll) => ({
        id: poll.id,
        title: poll.title,
        path: poll.path,
        role: "organizer" as const,
        lastInteractionAt: poll.lastInteractionAt,
      }))
      .sort(sortDashboardPolls)
  }, [initialUser, mergedPolls, trackedPolls])

  const joinedPolls = useMemo<DashboardPoll[]>(() => {
    if (initialUser) {
      return mergedPolls
        .filter((poll) => poll.role === "participant")
        .map(toDashboardPoll)
        .sort(sortDashboardPolls)
    }

    return trackedPolls
      .filter((poll) => poll.participant && !poll.organizer)
      .map((poll) => ({
        id: poll.id,
        title: poll.title,
        path: poll.path,
        role: "participant" as const,
        lastInteractionAt: poll.lastInteractionAt,
      }))
      .sort(sortDashboardPolls)
  }, [initialUser, mergedPolls, trackedPolls])

  const hasAnyPoll = createdPolls.length > 0 || joinedPolls.length > 0

  function onJoinSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setJoinError(null)

    const targetPath = parsePollPath(joinInput)
    if (!targetPath) {
      setJoinError("Enter a valid poll link or poll ID.")
      return
    }

    if (!initialUser) {
      setPendingGuestJoinPath(targetPath)
      return
    }

    router.push(targetPath)
  }

  function continueAsGuest() {
    if (!pendingGuestJoinPath) return
    router.push(pendingGuestJoinPath)
    setPendingGuestJoinPath(null)
  }

  async function removePoll(poll: DashboardPoll) {
    if (isMutatingPolls) return

    const isOrganizer = poll.role === "organizer"
    const confirmed = window.confirm(
      isOrganizer
        ? `Delete "${poll.title}" for everyone?`
        : `Leave "${poll.title}"? You can join again with the link later.`
    )

    if (!confirmed) return

    setIsMutatingPolls(true)
    try {
      if (!initialUser) {
        removeTrackedPoll(poll.id)
        return
      }

      const response = await fetch(`/api/polls/mine?pollId=${encodeURIComponent(poll.id)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        setAccountPolls((current) => current.filter((entry) => entry.id !== poll.id))
        removeTrackedPoll(poll.id)
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | { polls?: AccountPollSummary[] }
        | null

      if (payload?.polls && Array.isArray(payload.polls)) {
        setAccountPolls(payload.polls)
      } else {
        setAccountPolls((current) => current.filter((entry) => entry.id !== poll.id))
      }

      removeTrackedPoll(poll.id)
    } finally {
      setIsMutatingPolls(false)
    }
  }

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Date Poll</CardTitle>
            <CardDescription>
              Create new polls, or join an existing one by link or ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={createPollHref}>
                  <Plus className="size-4" />
                  Create poll
                </Link>
              </Button>
            </div>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onJoinSubmit}>
              <Input
                value={joinInput}
                onChange={(event) => setJoinInput(event.target.value)}
                placeholder="Paste poll link or enter poll ID"
                aria-label="Poll link or ID"
              />
              <Button type="submit" variant="outline">
                <Link2 className="size-4" />
                Join poll
              </Button>
            </form>
            {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
          </CardContent>
        </Card>

        {!hasAnyPoll ? (
          <Card>
            <CardHeader>
              <CardTitle>No polls yet</CardTitle>
              <CardDescription>
                You have not created or joined any polls yet. Create one or join with a link above.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <PollListSection
              title="Created Polls"
              description="Polls you organize."
              polls={createdPolls}
              emptyLabel="You have not created any polls yet."
              isMutatingPolls={isMutatingPolls}
              onRemovePoll={removePoll}
            />
            <PollListSection
              title="Joined Polls"
              description="Polls where you participate."
              polls={joinedPolls}
              emptyLabel="You have not joined any polls yet."
              isMutatingPolls={isMutatingPolls}
              onRemovePoll={removePoll}
            />
          </div>
        )}
      </div>

      <Dialog
        open={pendingGuestJoinPath !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingGuestJoinPath(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join as guest or create an account</DialogTitle>
            <DialogDescription>
              You can continue without an account and still vote, or create an account to keep your joined polls across devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={continueAsGuest}>
              <UserRound className="size-4" />
              Continue without account
            </Button>
            <Button type="button" asChild>
              <Link href={registerHref} onClick={() => setPendingGuestJoinPath(null)}>
                <UserPlus className="size-4" />
                Create account
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
