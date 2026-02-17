"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Circle,
  Fish,
  ListX,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Rainbow,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCreatePollPath, normalizeNextPath, type AuthUser } from "@/lib/auth/supabase-auth"
import {
  mergeAccountAndTrackedPolls,
  type AccountPollSummary,
} from "@/lib/date-poll/account-polls"
import {
  clearTrackedPolls,
  getTrackedPollsServerSnapshot,
  getTrackedPollsSnapshot,
  removeTrackedPoll,
  subscribeTrackedPolls,
} from "@/lib/date-poll/tracked-polls"
import { cn } from "@/lib/utils"

type Theme = "light" | "salmon" | "rainbow" | "graphite" | "dark"
type SidebarPoll = AccountPollSummary
type ConfirmState =
  | { type: "single"; pollId: string; pollTitle: string; pollRole: SidebarPoll["role"] }
  | { type: "all" }
  | null

const THEME_ORDER: Theme[] = ["light", "salmon", "rainbow", "graphite", "dark"]
const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  salmon: "Salmon",
  rainbow: "Rainbow",
  graphite: "Graphite",
  dark: "Dark",
}

function getCurrentTheme(): Theme {
  if (document.documentElement.classList.contains("rainbow")) return "rainbow"
  if (document.documentElement.classList.contains("salmon")) return "salmon"
  if (document.documentElement.classList.contains("prism")) return "salmon"
  if (document.documentElement.classList.contains("graphite")) return "graphite"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getNextTheme(theme: Theme): Theme {
  const currentIndex = THEME_ORDER.indexOf(theme)
  return THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark" || theme === "graphite")
  root.classList.toggle("salmon", theme === "salmon")
  root.classList.toggle("rainbow", theme === "rainbow")
  root.classList.toggle("prism", false)
  root.classList.toggle("graphite", theme === "graphite")
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
  const [pollMutationError, setPollMutationError] = useState<string | null>(null)
  const [accountPolls, setAccountPolls] = useState<AccountPollSummary[]>(initialAccountPolls)
  const [theme, setTheme] = useState<Theme>("light")
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
    setIsMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileNavOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavOpen])

  useEffect(() => {
    setAccountPolls(initialAccountPolls)
  }, [initialAccountPolls])

  useEffect(() => {
    const currentTheme = getCurrentTheme()
    applyTheme(currentTheme)
    setTheme(currentTheme)
  }, [])

  useEffect(() => {
    if (!initialUser) return

    let cancelled = false

    async function fetchAccountPolls() {
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
        // Silent fallback to existing sidebar state.
      }
    }

    fetchAccountPolls()
    window.addEventListener("focus", fetchAccountPolls)

    return () => {
      cancelled = true
      window.removeEventListener("focus", fetchAccountPolls)
    }
  }, [initialUser, trackedPolls, router])

  function toggleTheme() {
    const nextTheme = getNextTheme(getCurrentTheme())
    applyTheme(nextTheme)
    setTheme(nextTheme)
    window.localStorage.setItem("theme", nextTheme)
  }

  async function signOut() {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      clearTrackedPolls()
    } finally {
      window.location.href = "/login"
    }
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

  async function removeSinglePoll(pollId: string): Promise<boolean> {
    if (!initialUser) {
      removeTrackedPoll(pollId)
      if (isViewingPoll(pollId)) {
        redirectHome()
      }
      return true
    }

    const response = await fetch(`/api/polls/mine?pollId=${encodeURIComponent(pollId)}`, {
      method: "DELETE",
    })

    if (response.status === 401) {
      setAccountPolls([])
      router.refresh()
      setPollMutationError("Your session has expired. Please sign in again.")
      return false
    }

    if (!response.ok) {
      setPollMutationError(await readMutationError(response, "Could not update poll membership."))
      return false
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

    return true
  }

  async function removeAllPolls(): Promise<boolean> {
    if (!initialUser) {
      clearTrackedPolls()
      if (isViewingPollDetailPage()) {
        redirectHome()
      }
      return true
    }

    const response = await fetch("/api/polls/mine", { method: "DELETE" })

    if (response.status === 401) {
      setAccountPolls([])
      router.refresh()
      setPollMutationError("Your session has expired. Please sign in again.")
      return false
    }

    if (!response.ok) {
      setPollMutationError(await readMutationError(response, "Could not update poll membership."))
      return false
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

    return true
  }

  async function confirmRemoveAction() {
    if (!confirmState || isMutatingPolls) return

    setIsMutatingPolls(true)
    setPollMutationError(null)
    try {
      let isSuccess = false
      if (confirmState.type === "single") {
        isSuccess = await removeSinglePoll(confirmState.pollId)
      } else {
        isSuccess = await removeAllPolls()
      }

      if (isSuccess) {
        setConfirmState(null)
        setIsMobileNavOpen(false)
      }
    } finally {
      setIsMutatingPolls(false)
    }
  }

  const sidebarPolls = useMemo<SidebarPoll[]>(() => {
    if (initialUser) {
      return mergeAccountAndTrackedPolls({
        accountPolls,
        trackedPolls,
      })
    }

    return trackedPolls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      path: poll.path,
      role: "participant" as const,
      lastInteractionAt: poll.lastInteractionAt,
    }))
  }, [accountPolls, initialUser, trackedPolls])
  const ownedSidebarPolls = useMemo(
    () => sidebarPolls.filter((poll) => poll.role === "organizer"),
    [sidebarPolls]
  )
  const joinedSidebarPolls = useMemo(
    () => sidebarPolls.filter((poll) => poll.role === "participant"),
    [sidebarPolls]
  )
  const hasOwnedPolls = ownedSidebarPolls.length > 0
  const allPollsActionLabel = hasOwnedPolls
    ? "Leave/Delete all polls"
    : "Leave all polls"
  const footerClearLabel = hasOwnedPolls ? "Clear polls" : "Leave polls"
  const nextThemeLabel = THEME_LABEL[getNextTheme(theme)]

  function closeMobileNav() {
    setIsMobileNavOpen(false)
  }

  function pollClass(href: string) {
    return cn(
      "block min-w-0 flex-1 rounded-md px-3 py-2 transition-colors",
      pathname === href
        ? "bg-accent text-accent-foreground"
        : "hover:bg-accent/50"
    )
  }

  function renderPollRows(polls: SidebarPoll[], onNavigate?: () => void) {
    return polls.map((poll) => (
      <div key={poll.id} className="group flex items-center gap-1">
        <Link href={poll.path} className={pollClass(poll.path)} onClick={onNavigate}>
          <p className="truncate text-sm font-medium">{poll.title}</p>
          <p className="text-muted-foreground text-xs">
            {poll.role === "participant" ? "Participant" : "Organizer"}
          </p>
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={poll.role === "organizer" ? "destructive" : "ghost"}
              size="icon-xs"
              className={cn(
                "size-7 md:size-6",
                poll.role === "organizer"
                  ? "opacity-90 hover:opacity-100"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={`${poll.role === "organizer" ? "Delete" : "Leave"} ${poll.title}`}
              disabled={isMutatingPolls}
              onClick={() => {
                setPollMutationError(null)
                setConfirmState({
                  type: "single",
                  pollId: poll.id,
                  pollTitle: poll.title,
                  pollRole: poll.role,
                })
                closeMobileNav()
              }}
            >
              {poll.role === "organizer" ? (
                <Trash2 className="size-3.5" />
              ) : (
                <X className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {poll.role === "organizer" ? "Delete this poll" : "Leave this poll"}
          </TooltipContent>
        </Tooltip>
      </div>
    ))
  }

  function renderPollSection(args: {
    title: string
    polls: SidebarPoll[]
    emptyLabel: string
    onNavigate?: () => void
  }) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
          {args.title}
        </p>
        {args.polls.length > 0 ? (
          <div className="space-y-1">{renderPollRows(args.polls, args.onNavigate)}</div>
        ) : (
          <div className="text-muted-foreground rounded-md px-3 py-2 text-sm">
            {args.emptyLabel}
          </div>
        )}
      </div>
    )
  }

  function renderSidebarFooter(onNavigate?: () => void) {
    return (
      <div className="border-t p-3">
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-muted/25 to-background p-3">
          <div className="pointer-events-none absolute -top-12 -right-8 size-24 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 size-24 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative space-y-3">
            <div className="flex items-center gap-2">
              <div className="bg-background/90 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold shadow-sm">
                {getAvatarLetter(initialUser)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {initialUser?.fullName ?? initialUser?.email ?? "Guest"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {initialUser?.email ?? "Not signed in"}
                </p>
              </div>
            </div>

            {initialUser ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
                  <Link href="/settings" onClick={onNavigate}>
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-start"
                  disabled={isSigningOut}
                  onClick={() => {
                    onNavigate?.()
                    void signOut()
                  }}
                >
                  <LogOut className="size-4" />
                  {isSigningOut ? "Logging out..." : "Log out"}
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" variant="outline" className="w-full justify-start" asChild>
                <Link href={loginHref} onClick={onNavigate}>
                  <LogIn className="size-4" />
                  Log in
                </Link>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              aria-label={`Switch theme to ${nextThemeLabel}`}
              title={`Switch theme to ${nextThemeLabel}`}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Moon className="size-4" />
              ) : theme === "rainbow" ? (
                <Rainbow className="size-4" />
              ) : theme === "salmon" ? (
                <Fish className="size-4" />
              ) : theme === "graphite" ? (
                <Circle className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
              Theme: {THEME_LABEL[theme]}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              disabled={isMutatingPolls}
              onClick={() => {
                setPollMutationError(null)
                setConfirmState({ type: "all" })
                onNavigate?.()
              }}
            >
              <ListX className="size-4" />
              {footerClearLabel}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isAuthPage) {
    return <div className="min-h-screen text-foreground">{children}</div>
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card/30 md:flex md:flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Date Poll
          </Link>
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
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">
            {renderPollSection({
              title: "Your polls",
              polls: ownedSidebarPolls,
              emptyLabel: "No polls yet.",
            })}
            {renderPollSection({
              title: "Other polls",
              polls: joinedSidebarPolls,
              emptyLabel: "No joined polls yet.",
            })}
          </div>
        </ScrollArea>

        {renderSidebarFooter()}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsMobileNavOpen((prev) => !prev)}
                  aria-label="Toggle navigation"
                  aria-expanded={isMobileNavOpen}
                  aria-controls="mobile-sidebar"
                >
                  <Menu className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open navigation</TooltipContent>
            </Tooltip>
            <Link href="/" className="text-sm font-semibold tracking-wide">
              Date Poll
            </Link>
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
              <TooltipContent>Create poll</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>

      {isMobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={closeMobileNav}
          />
          <aside
            id="mobile-sidebar"
            className="fixed inset-y-0 left-0 z-40 flex w-[86vw] max-w-sm flex-col border-r bg-background shadow-xl md:hidden"
          >
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Link href="/" className="text-sm font-semibold tracking-wide" onClick={closeMobileNav}>
                Date Poll
              </Link>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Close navigation"
                    onClick={closeMobileNav}
                  >
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close navigation</TooltipContent>
              </Tooltip>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-4 p-3">
                {renderPollSection({
                  title: "Your polls",
                  polls: ownedSidebarPolls,
                  emptyLabel: "No polls yet.",
                  onNavigate: closeMobileNav,
                })}
                {renderPollSection({
                  title: "Other polls",
                  polls: joinedSidebarPolls,
                  emptyLabel: "No joined polls yet.",
                  onNavigate: closeMobileNav,
                })}
              </div>
            </ScrollArea>

            {renderSidebarFooter(closeMobileNav)}
          </aside>
        </>
      ) : null}

      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open && !isMutatingPolls) {
            setConfirmState(null)
            setPollMutationError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isMutatingPolls}>
          <DialogHeader>
            <DialogTitle>
              {confirmState?.type === "all"
                ? hasOwnedPolls
                  ? "Delete or leave all polls?"
                  : "Leave all polls?"
                : confirmState?.pollRole === "organizer"
                  ? "Delete poll?"
                  : "Leave poll?"}
            </DialogTitle>
            <DialogDescription>
              {confirmState?.type === "all"
                ? hasOwnedPolls
                  ? "Organizer polls will be deleted for everyone. Joined polls will be left."
                  : "This will remove all joined polls from your sidebar."
                : confirmState?.pollRole === "organizer"
                  ? `Delete "${confirmState?.pollTitle ?? "this poll"}" for everyone? This action cannot be undone.`
                  : `Leave "${confirmState?.pollTitle ?? "this poll"}"? You can join again with the link later.`}
            </DialogDescription>
          </DialogHeader>
          {pollMutationError ? <p className="text-sm text-destructive">{pollMutationError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isMutatingPolls}
              onClick={() => {
                setConfirmState(null)
                setPollMutationError(null)
              }}
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
                  ? allPollsActionLabel
                  : confirmState?.pollRole === "organizer"
                    ? "Delete poll"
                    : "Leave poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  )
}
