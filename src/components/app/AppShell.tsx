"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  ListX,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Plus,
  Rainbow,
  Sparkles,
  Settings,
  Sun,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast-provider"
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
import { useFlipListAnimation } from "@/lib/use-flip-list-animation"
import { cn } from "@/lib/utils"

type Theme = "light" | "rainbow" | "aurora" | "graphite" | "dark"
type SidebarPoll = AccountPollSummary
type ConfirmState =
  | { type: "single"; pollId: string; pollTitle: string; pollRole: SidebarPoll["role"] }
  | { type: "all" }
  | null

const THEME_ORDER: Theme[] = ["light", "rainbow", "aurora", "graphite", "dark"]
const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  rainbow: "Rainbow",
  aurora: "Antilight",
  graphite: "Graphite",
  dark: "Dark",
}

function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || theme === "graphite" || theme === "aurora"
}

function getCurrentTheme(): Theme {
  if (document.documentElement.classList.contains("aurora")) return "aurora"
  if (document.documentElement.classList.contains("rainbow")) return "rainbow"
  if (document.documentElement.classList.contains("graphite")) return "graphite"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function getNextLightDarkTheme(theme: Theme): Theme {
  return isDarkTheme(theme) ? "light" : "dark"
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle("dark", isDarkTheme(theme))
  root.classList.toggle("rainbow", theme === "rainbow")
  root.classList.toggle("aurora", theme === "aurora")
  root.classList.toggle("graphite", theme === "graphite")
}

function getThemeIcon(theme: Theme) {
  if (theme === "dark") return <Moon className="size-4" />
  if (theme === "rainbow") return <Rainbow className="size-4" />
  if (theme === "aurora") return <Sparkles className="size-4" />
  if (theme === "graphite") return <Circle className="size-4" />
  return <Sun className="size-4" />
}

function getAvatarLetter(user: AuthUser | null): string {
  const source = user?.fullName?.trim() || user?.email?.trim() || "Guest"
  const letter = source.charAt(0).toUpperCase()
  return letter || "G"
}

function getPollBadgeLabel(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
}

export function AppShell({
  children,
  initialUser,
  initialAccountPolls,
  initialTheme = null,
}: {
  children: React.ReactNode
  initialUser: AuthUser | null
  initialAccountPolls: AccountPollSummary[]
  initialTheme?: Theme | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isMutatingPolls, setIsMutatingPolls] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [pollMutationError, setPollMutationError] = useState<string | null>(null)
  const [accountPolls, setAccountPolls] = useState<AccountPollSummary[]>(initialAccountPolls)
  const [isRefreshingAccountPolls, setIsRefreshingAccountPolls] = useState(false)
  const [optimisticHiddenPollIds, setOptimisticHiddenPollIds] = useState<string[]>([])
  const [isOptimisticallyClearingAll, setIsOptimisticallyClearingAll] = useState(false)
  const [theme, setTheme] = useState<Theme | null>(initialTheme)
  const [isDesktopThemeSelectorOpen, setIsDesktopThemeSelectorOpen] = useState(false)
  const [isMobileThemeSelectorOpen, setIsMobileThemeSelectorOpen] = useState(false)
  const themeTransitionTimeoutRef = useRef<number | null>(null)
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
    if (!isMobileNavMounted) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileNavMounted])

  useEffect(() => {
    if (!isMobileNavMounted || isMobileNavOpen) return

    const timeout = window.setTimeout(() => {
      setIsMobileNavMounted(false)
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [isMobileNavMounted, isMobileNavOpen])

  useEffect(() => {
    setAccountPolls(initialAccountPolls)
  }, [initialAccountPolls])

  useEffect(() => {
    const currentTheme = getCurrentTheme()
    applyTheme(currentTheme)
    setTheme(currentTheme)
  }, [])

  useEffect(() => {
    try {
      setIsDesktopSidebarCollapsed(window.localStorage.getItem("sidebar-collapsed") === "true")
    } catch {
      setIsDesktopSidebarCollapsed(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (themeTransitionTimeoutRef.current) {
        window.clearTimeout(themeTransitionTimeoutRef.current)
      }
      document.documentElement.classList.remove("theme-switching")
    }
  }, [])

  useEffect(() => {
    if (!initialUser) return

    let cancelled = false

    async function fetchAccountPolls() {
      setIsRefreshingAccountPolls(true)
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
      } finally {
        if (!cancelled) {
          setIsRefreshingAccountPolls(false)
        }
      }
    }

    fetchAccountPolls()
    window.addEventListener("focus", fetchAccountPolls)

    return () => {
      cancelled = true
      window.removeEventListener("focus", fetchAccountPolls)
    }
  }, [initialUser, trackedPolls, router])

  function setThemePreference(nextTheme: Theme) {
    const root = document.documentElement
    root.classList.add("theme-switching")
    if (themeTransitionTimeoutRef.current) {
      window.clearTimeout(themeTransitionTimeoutRef.current)
    }
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      root.classList.remove("theme-switching")
      themeTransitionTimeoutRef.current = null
    }, 280)

    applyTheme(nextTheme)
    setTheme(nextTheme)
    window.localStorage.setItem("theme", nextTheme)
    document.cookie = `theme=${encodeURIComponent(nextTheme)}; path=/; max-age=31536000; samesite=lax`
  }

  function toggleTheme() {
    const nextTheme = getNextLightDarkTheme(getCurrentTheme())
    setThemePreference(nextTheme)
    toast({
      title: "Theme updated",
      description: `Switched to ${THEME_LABEL[nextTheme]}.`,
    })
  }

  function selectTheme(nextTheme: Theme) {
    setThemePreference(nextTheme)
    setIsDesktopThemeSelectorOpen(false)
    setIsMobileThemeSelectorOpen(false)
    toast({
      title: "Theme updated",
      description: `Switched to ${THEME_LABEL[nextTheme]}.`,
    })
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
      toast({
        variant: "success",
        title: "Poll removed",
        description: "This poll was removed from your sidebar.",
      })
      return true
    }

    const response = await fetch(`/api/polls/mine?pollId=${encodeURIComponent(pollId)}`, {
      method: "DELETE",
    })

    if (response.status === 401) {
      setAccountPolls([])
      router.refresh()
      setPollMutationError("Your session has expired. Please sign in again.")
      toast({
        variant: "error",
        title: "Session expired",
        description: "Please sign in again.",
      })
      return false
    }

    if (!response.ok) {
      const message = await readMutationError(response, "Could not update poll membership.")
      setPollMutationError(message)
      toast({
        variant: "error",
        title: "Could not update poll",
        description: message,
      })
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
    toast({
      variant: "success",
      title: "Poll updated",
      description: "Your poll list was updated.",
    })

    return true
  }

  async function removeAllPolls(): Promise<boolean> {
    if (!initialUser) {
      clearTrackedPolls()
      if (isViewingPollDetailPage()) {
        redirectHome()
      }
      toast({
        variant: "success",
        title: "Polls cleared",
        description: "All tracked polls were removed from your sidebar.",
      })
      return true
    }

    const response = await fetch("/api/polls/mine", { method: "DELETE" })

    if (response.status === 401) {
      setAccountPolls([])
      router.refresh()
      setPollMutationError("Your session has expired. Please sign in again.")
      toast({
        variant: "error",
        title: "Session expired",
        description: "Please sign in again.",
      })
      return false
    }

    if (!response.ok) {
      const message = await readMutationError(response, "Could not update poll membership.")
      setPollMutationError(message)
      toast({
        variant: "error",
        title: "Could not update polls",
        description: message,
      })
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
    toast({
      variant: "success",
      title: "Polls cleared",
      description: "All tracked polls were removed from your sidebar.",
    })

    return true
  }

  async function confirmRemoveAction() {
    if (!confirmState || isMutatingPolls) return

    const pendingConfirmState = confirmState
    const previousAccountPolls = accountPolls
    const optimisticPollId =
      pendingConfirmState.type === "single" ? pendingConfirmState.pollId : null

    setIsMutatingPolls(true)
    setPollMutationError(null)
    setConfirmState(null)
    setIsMobileNavOpen(false)

    if (optimisticPollId) {
      setOptimisticHiddenPollIds((current) => [...new Set([...current, optimisticPollId])])
      if (isViewingPoll(optimisticPollId)) {
        redirectHome()
      }
    } else {
      setIsOptimisticallyClearingAll(true)
      if (isViewingPollDetailPage()) {
        redirectHome()
      }
    }

    try {
      let isSuccess = false
      if (pendingConfirmState.type === "single") {
        isSuccess = await removeSinglePoll(pendingConfirmState.pollId)
      } else {
        isSuccess = await removeAllPolls()
      }

      if (isSuccess) {
        if (optimisticPollId) {
          setOptimisticHiddenPollIds((current) =>
            current.filter((pollId) => pollId !== optimisticPollId)
          )
        } else {
          setIsOptimisticallyClearingAll(false)
          setOptimisticHiddenPollIds([])
        }
      } else {
        if (initialUser) {
          setAccountPolls(previousAccountPolls)
        }
        if (optimisticPollId) {
          setOptimisticHiddenPollIds((current) =>
            current.filter((pollId) => pollId !== optimisticPollId)
          )
        } else {
          setIsOptimisticallyClearingAll(false)
        }
      }
    } finally {
      setIsMutatingPolls(false)
    }
  }

  const baseSidebarPolls = useMemo<SidebarPoll[]>(() => {
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
  const sidebarPolls = useMemo(() => {
    if (isOptimisticallyClearingAll) {
      return []
    }
    if (optimisticHiddenPollIds.length === 0) {
      return baseSidebarPolls
    }

    const hiddenPollIds = new Set(optimisticHiddenPollIds)
    return baseSidebarPolls.filter((poll) => !hiddenPollIds.has(poll.id))
  }, [baseSidebarPolls, isOptimisticallyClearingAll, optimisticHiddenPollIds])
  const ownedSidebarPolls = useMemo(
    () => sidebarPolls.filter((poll) => poll.role === "organizer"),
    [sidebarPolls]
  )
  const joinedSidebarPolls = useMemo(
    () => sidebarPolls.filter((poll) => poll.role === "participant"),
    [sidebarPolls]
  )
  const ownedSidebarPollIds = useMemo(
    () => ownedSidebarPolls.map((poll) => poll.id),
    [ownedSidebarPolls]
  )
  const joinedSidebarPollIds = useMemo(
    () => joinedSidebarPolls.map((poll) => poll.id),
    [joinedSidebarPolls]
  )
  const bindOwnedPollRowRef = useFlipListAnimation(ownedSidebarPollIds)
  const bindJoinedPollRowRef = useFlipListAnimation(joinedSidebarPollIds)
  const hasOwnedPolls = ownedSidebarPolls.length > 0
  const allPollsActionLabel = hasOwnedPolls
    ? "Leave/Delete all polls"
    : "Leave all polls"
  const footerClearLabel = hasOwnedPolls ? "Clear polls" : "Leave polls"
  const showSidebarPollSkeleton = isMutatingPolls && isOptimisticallyClearingAll
  const isThemeResolved = theme !== null
  const activeTheme: Theme = theme ?? "light"
  const lightDarkTargetTheme = isDarkTheme(activeTheme) ? "light" : "dark"
  const lightDarkTargetLabel = THEME_LABEL[lightDarkTargetTheme]

  useEffect(() => {
    const prefetchPaths = new Set<string>([createPollHref])
    for (const poll of sidebarPolls) {
      prefetchPaths.add(poll.path)
    }

    for (const path of prefetchPaths) {
      router.prefetch(path)
    }
  }, [createPollHref, router, sidebarPolls])

  function openMobileNav() {
    setIsMobileNavMounted(true)
    window.requestAnimationFrame(() => {
      setIsMobileNavOpen(true)
    })
  }

  function closeMobileNav() {
    setIsMobileNavOpen(false)
    setIsMobileThemeSelectorOpen(false)
  }

  function toggleDesktopSidebar() {
    setIsDesktopSidebarCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem("sidebar-collapsed", String(next))
      } catch {
        // Ignore write failures.
      }
      return next
    })
  }

  function pollClass(href: string, isCompact = false) {
    return cn(
      isCompact
        ? "flex size-9 items-center justify-center rounded-md border transition-colors"
        : "block min-w-0 flex-1 rounded-md px-3 py-2 transition-colors",
      pathname === href
        ? isCompact
          ? "bg-accent text-accent-foreground border-primary/30 shadow-sm"
          : "bg-accent text-accent-foreground"
        : isCompact
          ? "border-transparent hover:bg-accent/50"
          : "hover:bg-accent/50"
    )
  }

  function renderPollRows(args: {
    polls: SidebarPoll[]
    bindRowRef: ReturnType<typeof useFlipListAnimation>
    onNavigate?: () => void
    isCompact?: boolean
  }) {
    return args.polls.map((poll) => (
      <div
        key={poll.id}
        ref={args.bindRowRef(poll.id)}
        className={cn(
          "group flex items-center gap-1 motion-safe:will-change-transform",
          args.isCompact && "justify-center"
        )}
      >
        {args.isCompact ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={poll.path}
                className={pollClass(poll.path, true)}
                onClick={args.onNavigate}
              >
                <span className="text-[10px] font-semibold tracking-wide">
                  {getPollBadgeLabel(poll.title)}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">{poll.title}</p>
                <p className="text-muted-foreground text-[11px]">
                  {poll.role === "participant" ? "Participant" : "Organizer"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Link href={poll.path} className={pollClass(poll.path)} onClick={args.onNavigate}>
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
          </>
        )}
      </div>
    ))
  }

  function renderPollSection(args: {
    title: string
    polls: SidebarPoll[]
    bindRowRef: ReturnType<typeof useFlipListAnimation>
    emptyLabel: string
    isLoading?: boolean
    showSkeleton?: boolean
    onNavigate?: () => void
    isCompact?: boolean
  }) {
    return (
      <div className="space-y-1">
        <p
          className={cn(
            "text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase",
            args.isCompact && "sr-only"
          )}
        >
          {args.title}
        </p>
        {args.showSkeleton ? (
          <div className={cn("space-y-1", args.isCompact && "space-y-2")}>
            {Array.from({ length: args.isCompact ? 4 : 3 }).map((_, index) => (
              <div
                key={`skeleton-${args.title}-${index}`}
                className={cn("flex items-center gap-1", args.isCompact && "justify-center")}
              >
                {args.isCompact ? (
                  <Skeleton className="size-9 rounded-md" />
                ) : (
                  <Skeleton className="h-11 flex-1 rounded-md" />
                )}
              </div>
            ))}
          </div>
        ) : args.polls.length > 0 ? (
          <div className={cn("space-y-1", args.isCompact && "space-y-2")}>
            {renderPollRows({
              polls: args.polls,
              bindRowRef: args.bindRowRef,
              onNavigate: args.onNavigate,
              isCompact: args.isCompact,
            })}
          </div>
        ) : args.isLoading ? (
          <div className={cn("space-y-1", args.isCompact && "space-y-2")}>
            {Array.from({ length: args.isCompact ? 3 : 2 }).map((_, index) => (
              <div
                key={`loading-${args.title}-${index}`}
                className={cn("flex items-center gap-1", args.isCompact && "justify-center")}
              >
                {args.isCompact ? (
                  <Skeleton className="size-9 rounded-md" />
                ) : (
                  <Skeleton className="h-11 flex-1 rounded-md" />
                )}
              </div>
            ))}
          </div>
        ) : (
          args.isCompact ? null : (
            <div className="text-muted-foreground rounded-md px-3 py-2 text-sm">
              {args.emptyLabel}
            </div>
          )
        )}
      </div>
    )
  }

  function renderSidebarFooter(onNavigate?: () => void, isCompact = false) {
    if (isCompact) {
      return (
        <div className="border-t p-2">
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-muted/25 to-background p-2">
            <div className="pointer-events-none absolute -top-8 -right-6 size-16 rounded-full bg-primary/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-7 -left-6 size-16 rounded-full bg-emerald-500/10 blur-2xl" />

            <div className="relative flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-background/90 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold shadow-sm">
                    {getAvatarLetter(initialUser)}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {initialUser?.fullName ?? initialUser?.email ?? "Guest"}
                </TooltipContent>
              </Tooltip>

              {initialUser ? null : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" asChild>
                      <Link href={loginHref} onClick={onNavigate}>
                        <LogIn className="size-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Log in</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={
                      isThemeResolved
                        ? `Switch theme to ${lightDarkTargetLabel}`
                        : "Loading theme"
                    }
                    title={
                      isThemeResolved
                        ? `Switch theme to ${lightDarkTargetLabel}`
                        : "Loading theme"
                    }
                    disabled={!isThemeResolved}
                    onClick={toggleTheme}
                  >
                    {isThemeResolved ? (
                      getThemeIcon(activeTheme)
                    ) : (
                      <Skeleton className="size-4 rounded-full" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isThemeResolved ? `Theme: ${THEME_LABEL[activeTheme]}` : "Loading theme..."}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={isMutatingPolls}
                    onClick={() => {
                      setPollMutationError(null)
                      setConfirmState({ type: "all" })
                      onNavigate?.()
                    }}
                  >
                    <ListX className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{footerClearLabel}</TooltipContent>
              </Tooltip>

              {initialUser ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon-sm" variant="ghost" asChild>
                      <Link href="/settings" onClick={onNavigate}>
                        <Settings className="size-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
              ) : null}

              {initialUser ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      disabled={isSigningOut}
                      onClick={() => {
                        onNavigate?.()
                        void signOut()
                      }}
                    >
                      <LogOut className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {isSigningOut ? "Logging out..." : "Log out"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      )
    }

    const isMobileFooter = typeof onNavigate === "function"
    const isThemeSelectorOpen = isMobileFooter
      ? isMobileThemeSelectorOpen
      : isDesktopThemeSelectorOpen
    const setIsThemeSelectorOpen = isMobileFooter
      ? setIsMobileThemeSelectorOpen
      : setIsDesktopThemeSelectorOpen

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

            {initialUser ? null : (
              <Button type="button" size="sm" variant="outline" className="w-full justify-start" asChild>
                <Link href={loginHref} onClick={onNavigate}>
                  <LogIn className="size-4" />
                  Log in
                </Link>
              </Button>
            )}

            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="flex-1 justify-start"
                aria-label={
                  isThemeResolved ? `Switch theme to ${lightDarkTargetLabel}` : "Loading theme"
                }
                title={isThemeResolved ? `Switch theme to ${lightDarkTargetLabel}` : "Loading theme"}
                disabled={!isThemeResolved}
                onClick={toggleTheme}
              >
                {isThemeResolved ? (
                  <>
                    {getThemeIcon(activeTheme)}
                    Theme: {THEME_LABEL[activeTheme]}
                  </>
                ) : (
                  <>
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3 w-24 rounded-full" />
                  </>
                )}
              </Button>
              <Popover
                open={isThemeResolved ? isThemeSelectorOpen : false}
                onOpenChange={(open) => {
                  if (!isThemeResolved) return
                  setIsThemeSelectorOpen(open)
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-8"
                    aria-label="Open theme selector"
                    title="Select theme"
                    disabled={!isThemeResolved}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-44 p-1">
                  <div className="space-y-1">
                    {THEME_ORDER.map((themeOption) => (
                      <Button
                        key={themeOption}
                        type="button"
                        size="sm"
                        variant={themeOption === activeTheme && isThemeResolved ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => selectTheme(themeOption)}
                      >
                        {getThemeIcon(themeOption)}
                        {THEME_LABEL[themeOption]}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

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

            {initialUser ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" className="w-full justify-center" asChild>
                  <Link href="/settings" onClick={onNavigate}>
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="w-full justify-center"
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
            ) : null}
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
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden border-r bg-card/30 transition-[width] duration-200 md:flex md:flex-col",
            isDesktopSidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          <div
            className={cn(
              "flex h-16 border-b",
              isDesktopSidebarCollapsed
                ? "items-center justify-center px-1"
                : "items-center justify-between px-4"
            )}
          >
            {isDesktopSidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Expand sidebar"
                    aria-pressed={isDesktopSidebarCollapsed}
                    onClick={toggleDesktopSidebar}
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Link href="/" className="text-sm font-semibold tracking-wide">
                  Date Poll
                </Link>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={createPollHref}
                        aria-label="Create poll"
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon-sm",
                        })}
                      >
                        <Plus className="size-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">Create poll</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Collapse sidebar"
                        aria-pressed={isDesktopSidebarCollapsed}
                        onClick={toggleDesktopSidebar}
                      >
                        <ChevronsLeft className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Collapse sidebar</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className={cn("space-y-4 p-3", isDesktopSidebarCollapsed && "space-y-3 px-2 py-3")}>
              {renderPollSection({
                title: "Your polls",
                polls: ownedSidebarPolls,
                bindRowRef: bindOwnedPollRowRef,
                emptyLabel: "No polls yet.",
                isLoading: isRefreshingAccountPolls,
                showSkeleton: showSidebarPollSkeleton,
                isCompact: isDesktopSidebarCollapsed,
              })}
              {renderPollSection({
                title: "Other polls",
                polls: joinedSidebarPolls,
                bindRowRef: bindJoinedPollRowRef,
                emptyLabel: "No joined polls yet.",
                isLoading: isRefreshingAccountPolls,
                showSkeleton: showSidebarPollSkeleton,
                isCompact: isDesktopSidebarCollapsed,
              })}
            </div>
          </ScrollArea>

          {renderSidebarFooter(undefined, isDesktopSidebarCollapsed)}
        </aside>

        <div
          className={cn(
            "flex min-h-screen min-w-0 flex-col transition-[padding-left] duration-200",
            isDesktopSidebarCollapsed ? "md:pl-16" : "md:pl-64"
          )}
        >
          <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (isMobileNavOpen) {
                        closeMobileNav()
                        return
                      }
                      openMobileNav()
                    }}
                    aria-label="Toggle navigation"
                    aria-expanded={isMobileNavOpen}
                    aria-controls="mobile-sidebar"
                  >
                    <Menu className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMobileNavOpen ? "Close navigation" : "Open navigation"}</TooltipContent>
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

        {isMobileNavMounted ? (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              className={cn(
                "fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200 md:hidden",
                isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              onClick={closeMobileNav}
            />
            <aside
              id="mobile-sidebar"
              className={cn(
                "fixed inset-y-0 left-0 z-40 flex w-[86vw] max-w-sm flex-col border-r bg-background shadow-xl transition-transform duration-200 ease-out md:hidden",
                isMobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
              )}
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
                    bindRowRef: bindOwnedPollRowRef,
                    emptyLabel: "No polls yet.",
                    isLoading: isRefreshingAccountPolls,
                    showSkeleton: showSidebarPollSkeleton,
                    onNavigate: closeMobileNav,
                  })}
                  {renderPollSection({
                    title: "Other polls",
                    polls: joinedSidebarPolls,
                    bindRowRef: bindJoinedPollRowRef,
                    emptyLabel: "No joined polls yet.",
                    isLoading: isRefreshingAccountPolls,
                    showSkeleton: showSidebarPollSkeleton,
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
