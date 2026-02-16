"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, Moon, Plus, Sun, Trash2, X } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCreatePollPath, normalizeNextPath, type AuthUser } from "@/lib/auth/supabase-auth"
import type { AccountPollSummary } from "@/lib/date-poll/account-polls"
import {
  clearTrackedPolls,
  getTrackedPollsServerSnapshot,
  getTrackedPollsSnapshot,
  removeTrackedPoll,
  subscribeTrackedPolls,
} from "@/lib/date-poll/tracked-polls"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"
type SidebarPoll = AccountPollSummary
type ConfirmState =
  | { type: "single"; pollId: string; pollTitle: string; pollRole: SidebarPoll["role"] }
  | { type: "all" }
  | null

function resolveInitialTheme(): Theme {
  const stored = window.localStorage.getItem("theme")
  if (stored === "light" || stored === "dark") {
    return stored
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

function getAvatarLetter(user: AuthUser | null): string {
  const source = user?.fullName?.trim() || user?.email?.trim() || "Guest"
  const letter = source.charAt(0).toUpperCase()
  return letter || "G"
}

export function AppShell({
  children,
  initialUser,
  initialAccountPolls,
}: {
  children: React.ReactNode
  initialUser: AuthUser | null
  initialAccountPolls: AccountPollSummary[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMutatingPolls, setIsMutatingPolls] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [accountPolls, setAccountPolls] = useState<AccountPollSummary[]>(initialAccountPolls)
  const trackedPolls = useSyncExternalStore(
    subscribeTrackedPolls,
    getTrackedPollsSnapshot,
    getTrackedPollsServerSnapshot
  )
  const isAuthPage = pathname === "/login" || pathname === "/register"
  const createPollHref = initialUser
    ? getCreatePollPath()
    : `/login?next=${encodeURIComponent(normalizeNextPath(getCreatePollPath()))}`
  const loginHref = `/login?next=${encodeURIComponent(normalizeNextPath(pathname))}`

  useEffect(() => {
    const initialTheme = resolveInitialTheme()
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    setAccountPolls(initialAccountPolls)
  }, [initialAccountPolls])

  useEffect(() => {
    if (!initialUser) return

    let cancelled = false

    async function fetchAccountPolls() {
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
        // Silent fallback to existing sidebar state.
      }
    }

    fetchAccountPolls()

    return () => {
      cancelled = true
    }
  }, [initialUser, trackedPolls])

  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark"
    applyTheme(nextTheme)
    window.localStorage.setItem("theme", nextTheme)
  }

  async function signOut() {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.href = "/login"
    }
  }

  function isViewingPoll(pollId: string): boolean {
    const basePath = `/poll/${pollId}`
    return pathname === basePath || pathname.startsWith(`${basePath}/`)
  }

  function isViewingPollDetailPage(): boolean {
    const segments = pathname.split("/").filter(Boolean)
    if (segments[0] !== "poll") return false
    if (!segments[1] || segments[1] === "new") return false
    if (segments.length === 2) return true
    return segments.length === 3 && segments[2] === "results"
  }

  function redirectHome() {
    router.push("/")
    router.refresh()
  }

  async function removeSinglePoll(pollId: string) {
    if (!initialUser) {
      removeTrackedPoll(pollId)
      if (isViewingPoll(pollId)) {
        redirectHome()
      }
      return
    }

    const response = await fetch(`/api/polls/mine?pollId=${encodeURIComponent(pollId)}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      setAccountPolls((current) => current.filter((poll) => poll.id !== pollId))
      removeTrackedPoll(pollId)
      if (isViewingPoll(pollId)) {
        redirectHome()
      }
      return
    }

    const payload = (await response.json().catch(() => null)) as
      | { polls?: AccountPollSummary[] }
      | null

    if (payload?.polls && Array.isArray(payload.polls)) {
      setAccountPolls(payload.polls)
    } else {
      setAccountPolls((current) => current.filter((poll) => poll.id !== pollId))
    }

    removeTrackedPoll(pollId)
    if (isViewingPoll(pollId)) {
      redirectHome()
    }
  }

  async function removeAllPolls() {
    if (!initialUser) {
      clearTrackedPolls()
      if (isViewingPollDetailPage()) {
        redirectHome()
      }
      return
    }

    const response = await fetch("/api/polls/mine", { method: "DELETE" })

    if (!response.ok) {
      setAccountPolls([])
      clearTrackedPolls()
      if (isViewingPollDetailPage()) {
        redirectHome()
      }
      return
    }

    const payload = (await response.json().catch(() => null)) as
      | { polls?: AccountPollSummary[] }
      | null

    if (payload?.polls && Array.isArray(payload.polls)) {
      setAccountPolls(payload.polls)
    } else {
      setAccountPolls([])
    }

    clearTrackedPolls()
    if (isViewingPollDetailPage()) {
      redirectHome()
    }
  }

  async function confirmRemoveAction() {
    if (!confirmState || isMutatingPolls) return

    setIsMutatingPolls(true)
    try {
      if (confirmState.type === "single") {
        await removeSinglePoll(confirmState.pollId)
      } else {
        await removeAllPolls()
      }
    } finally {
      setIsMutatingPolls(false)
      setConfirmState(null)
      setIsMobileNavOpen(false)
    }
  }

  const sidebarPolls: SidebarPoll[] = initialUser
    ? accountPolls
    : trackedPolls.map((poll) => ({
        id: poll.id,
        title: poll.title,
        path: poll.path,
        role: poll.organizer ? "organizer" : "participant",
        lastInteractionAt: poll.lastInteractionAt,
      }))
  const hasOwnedPolls = sidebarPolls.some((poll) => poll.role === "organizer")
  const allProjectsActionLabel = hasOwnedPolls
    ? "Leave/Delete all projects"
    : "Leave all projects"

  function pollClass(href: string) {
    return cn(
      "block min-w-0 flex-1 rounded-md px-3 py-2 transition-colors",
      pathname === href
        ? "bg-accent text-accent-foreground"
        : "hover:bg-accent/50"
    )
  }

  function renderPollList(onNavigate?: () => void) {
    if (sidebarPolls.length === 0) {
      return (
        <div className="text-muted-foreground rounded-md px-3 py-2 text-sm">
          No polls yet.
        </div>
      )
    }

    return sidebarPolls.map((poll) => (
      <div key={poll.id} className="group flex items-center gap-1">
        <Link href={poll.path} className={pollClass(poll.path)} onClick={onNavigate}>
          <p className="truncate text-sm font-medium">{poll.title}</p>
          <p className="text-muted-foreground text-xs">
            {poll.role === "participant" ? "Participant" : "Organizer"}
          </p>
        </Link>
        <Button
          type="button"
          variant={poll.role === "organizer" ? "destructive" : "ghost"}
          size="icon-xs"
          className={
            poll.role === "organizer"
              ? "opacity-90 hover:opacity-100"
              : "text-muted-foreground hover:text-foreground"
          }
          aria-label={`${poll.role === "organizer" ? "Delete" : "Leave"} ${poll.title}`}
          disabled={isMutatingPolls}
          onClick={() =>
            setConfirmState({
              type: "single",
              pollId: poll.id,
              pollTitle: poll.title,
              pollRole: poll.role,
            })
          }
        >
          {poll.role === "organizer" ? (
            <Trash2 className="size-3.5" />
          ) : (
            <X className="size-3.5" />
          )}
        </Button>
      </div>
    ))
  }

  function renderThemeSwitch(side: "top" | "bottom") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              <Sun className="hidden size-4 dark:block" />
              <Moon className="size-4 dark:hidden" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>Toggle theme</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  function renderUserMenu() {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Account menu"
            className="rounded-full font-semibold"
          >
            {getAvatarLetter(initialUser)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 space-y-2 p-2">
          <div className="px-2 py-1">
            <p className="truncate text-sm font-medium">
              {initialUser?.fullName ?? initialUser?.email ?? "Guest"}
            </p>
            {initialUser?.email ? (
              <p className="text-muted-foreground truncate text-xs">{initialUser.email}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            disabled={isMutatingPolls}
            onClick={() => setConfirmState({ type: "all" })}
          >
            {allProjectsActionLabel}
          </Button>
          {initialUser ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              disabled={isSigningOut}
              onClick={signOut}
            >
              Log out
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="w-full justify-start" asChild>
              <Link href={loginHref}>Log in</Link>
            </Button>
          )}
        </PopoverContent>
      </Popover>
    )
  }

  if (isAuthPage) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card/30 md:flex md:flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Date Poll
          </Link>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={createPollHref}
                  aria-label="Create poll"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Plus className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Create poll</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
              Your polls
            </p>
            <div className="space-y-1">{renderPollList()}</div>
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <div className="flex items-center justify-between">
            {renderThemeSwitch("top")}
            {renderUserMenu()}
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <Menu className="size-4" />
            </Button>
            <Link href="/" className="text-sm font-semibold tracking-wide">
              Date Poll
            </Link>
            <Link
              href={createPollHref}
              aria-label="Create poll"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <Plus className="size-4" />
            </Link>
          </div>
        </header>

        {isMobileNavOpen ? (
          <div className="border-b bg-card/40 px-4 py-3 md:hidden">
            <div className="mb-3 space-y-1">
              <p className="text-muted-foreground px-3 text-xs font-medium tracking-wide uppercase">
                Your polls
              </p>
              {renderPollList(() => setIsMobileNavOpen(false))}
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              {renderThemeSwitch("bottom")}
              {renderUserMenu()}
            </div>
          </div>
        ) : null}

        <div className="flex-1">{children}</div>
      </div>

      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open && !isMutatingPolls) {
            setConfirmState(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isMutatingPolls}>
          <DialogHeader>
            <DialogTitle>
              {confirmState?.type === "all"
                ? hasOwnedPolls
                  ? "Delete or leave all projects?"
                  : "Leave all projects?"
                : confirmState?.pollRole === "organizer"
                  ? "Delete poll?"
                  : "Leave poll?"}
            </DialogTitle>
            <DialogDescription>
              {confirmState?.type === "all"
                ? hasOwnedPolls
                  ? "Creator projects will be deleted for everyone. Joined projects will be left."
                  : "This will remove all joined projects from your sidebar."
                : confirmState?.pollRole === "organizer"
                  ? `Delete "${confirmState?.pollTitle ?? "this poll"}" for everyone? This action cannot be undone.`
                  : `Leave "${confirmState?.pollTitle ?? "this poll"}"? You can join again with the link later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isMutatingPolls}
              onClick={() => setConfirmState(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isMutatingPolls}
              onClick={confirmRemoveAction}
            >
              {isMutatingPolls
                ? "Please wait..."
                : confirmState?.type === "all"
                  ? allProjectsActionLabel
                  : confirmState?.pollRole === "organizer"
                    ? "Delete poll"
                    : "Leave poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
