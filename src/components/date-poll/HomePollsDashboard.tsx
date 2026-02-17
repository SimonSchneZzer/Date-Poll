"use client"

import { CalendarDays, Link2, LogIn, Plus, Trash2, UserPlus, UserRound, X } from "lucide-react"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

type RemoveConfirmState = {
  pollId: string
  pollTitle: string
  pollRole: DashboardPoll["role"]
} | null

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
    <Card className="h-full">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-6">
        {polls.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-sm">
            {emptyLabel}
          </div>
        ) : (
          <TooltipProvider>
            {polls.map((poll) => (
              <div key={poll.id} className="group flex items-center gap-2">
                <Link
                  href={poll.path}
                  className="hover:bg-accent/40 flex min-w-0 flex-1 items-center justify-between rounded-md border bg-background/70 px-3 py-2 transition-colors"
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
                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent>
                    {poll.role === "organizer" ? "Delete this poll" : "Leave this poll"}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </TooltipProvider>
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
  const [removeConfirmState, setRemoveConfirmState] = useState<RemoveConfirmState>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const createPollHref = initialUser
    ? getCreatePollPath()
    : `/login?next=${encodeURIComponent(normalizeNextPath(getCreatePollPath()))}`
  const registerHref = `/register?next=${encodeURIComponent(
    normalizeNextPath(pendingGuestJoinPath ?? "/")
  )}`
  const loginHref = `/login?next=${encodeURIComponent(normalizeNextPath(pendingGuestJoinPath ?? "/"))}`

  useEffect(() => {
    setAccountPolls(initialAccountPolls)
  }, [initialAccountPolls])

  useEffect(() => {
    if (!initialUser) return

    let cancelled = false

    async function refresh() {
      try {
        const response = await fetch("/api/polls/mine", { method: "GET", cache: "no-store" })
        if (response.status === 401) {
          if (cancelled) return
          setAccountPolls([])
          router.refresh()
          return
        }

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
    window.addEventListener("focus", refresh)

    return () => {
      cancelled = true
      window.removeEventListener("focus", refresh)
    }
  }, [initialUser, router, trackedPolls])

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

    return []
  }, [initialUser, mergedPolls])

  const joinedPolls = useMemo<DashboardPoll[]>(() => {
    if (initialUser) {
      return mergedPolls
        .filter((poll) => poll.role === "participant")
        .map(toDashboardPoll)
        .sort(sortDashboardPolls)
    }

    return trackedPolls
      .filter((poll) => poll.participant || poll.organizer)
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

  function requestRemovePoll(poll: DashboardPoll) {
    if (isMutatingPolls) return

    setRemoveError(null)
    setRemoveConfirmState({
      pollId: poll.id,
      pollTitle: poll.title,
      pollRole: poll.role,
    })
  }

  async function readMutationError(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; errors?: string[] }
      | null

    if (payload?.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
      return payload.errors.join(". ")
    }

    if (payload?.error) {
      return payload.error
    }

    return fallback
  }

  async function removePoll(pollId: string): Promise<boolean> {
    if (!initialUser) {
      removeTrackedPoll(pollId)
      return true
    }

    const response = await fetch(`/api/polls/mine?pollId=${encodeURIComponent(pollId)}`, {
      method: "DELETE",
    })

    if (response.status === 401) {
      setAccountPolls([])
      router.refresh()
      setRemoveError("Your session has expired. Please sign in again.")
      return false
    }

    if (!response.ok) {
      setRemoveError(await readMutationError(response, "Could not update poll membership."))
      return false
    }

    const payload = (await response.json().catch(() => null)) as
      | { polls?: AccountPollSummary[] }
      | null

    if (payload?.polls && Array.isArray(payload.polls)) {
      setAccountPolls(payload.polls)
    } else {
      setAccountPolls((current) => current.filter((entry) => entry.id !== pollId))
    }

    removeTrackedPoll(pollId)
    router.refresh()
    return true
  }

  async function confirmRemovePoll() {
    if (!removeConfirmState || isMutatingPolls) return

    setIsMutatingPolls(true)
    setRemoveError(null)
    try {
      const isSuccess = await removePoll(removeConfirmState.pollId)
      if (isSuccess) {
        setRemoveConfirmState(null)
      }
    } finally {
      setIsMutatingPolls(false)
    }
  }

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                Dashboard
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Date Poll</h1>
              <p className="text-muted-foreground max-w-xl text-sm">
                Create new polls, or join an existing one by link or ID.
              </p>
            </div>
            <div className="bg-background/80 text-muted-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
              <CalendarDays className="size-4 shrink-0" />
              <span className="truncate">
                {initialUser?.email
                  ? `Signed in: ${initialUser.email}`
                  : `${joinedPolls.length} tracked poll${joinedPolls.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Created: {createdPolls.length}</Badge>
            <Badge variant="secondary">Joined: {joinedPolls.length}</Badge>
          </div>
        </section>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>
              Start a poll or jump into one using a link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-2">
              <Button className="w-full sm:w-auto" asChild>
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
              <Button type="submit" className="w-full sm:w-auto" variant="outline">
                <Link2 className="size-4" />
                Join poll
              </Button>
            </form>
            {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
          </CardContent>
        </Card>

        {!hasAnyPoll ? (
          <Card>
            <CardHeader className="border-b">
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
              onRemovePoll={requestRemovePoll}
            />
            <PollListSection
              title="Joined Polls"
              description="Polls where you participate."
              polls={joinedPolls}
              emptyLabel="You have not joined any polls yet."
              isMutatingPolls={isMutatingPolls}
              onRemovePoll={requestRemovePoll}
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
            <DialogTitle>Join as guest, sign in, or create an account</DialogTitle>
            <DialogDescription>
              Continue without an account, sign in to use your existing profile, or register to keep joined polls across devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={continueAsGuest}>
              <UserRound className="size-4" />
              Continue without account
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={loginHref} onClick={() => setPendingGuestJoinPath(null)}>
                <LogIn className="size-4" />
                Sign in
              </Link>
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

      <Dialog
        open={removeConfirmState !== null}
        onOpenChange={(open) => {
          if (!open && !isMutatingPolls) {
            setRemoveConfirmState(null)
            setRemoveError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isMutatingPolls}>
          <DialogHeader>
            <DialogTitle>
              {removeConfirmState?.pollRole === "organizer" ? "Delete poll?" : "Leave poll?"}
            </DialogTitle>
            <DialogDescription>
              {removeConfirmState?.pollRole === "organizer"
                ? `Delete "${removeConfirmState.pollTitle}" for everyone? This action cannot be undone.`
                : `Leave "${removeConfirmState?.pollTitle}"? You can join again with the link later.`}
            </DialogDescription>
          </DialogHeader>
          {removeError ? <p className="text-sm text-destructive">{removeError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isMutatingPolls}
              onClick={() => {
                setRemoveConfirmState(null)
                setRemoveError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isMutatingPolls}
              onClick={confirmRemovePoll}
            >
              {isMutatingPolls
                ? "Please wait..."
                : removeConfirmState?.pollRole === "organizer"
                  ? "Delete poll"
                  : "Leave poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
