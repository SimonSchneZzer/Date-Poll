"use client"

import { eachDayOfInterval, formatISO, startOfDay } from "date-fns"
import { ArrowRight, CalendarDays, Check, Copy, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-poll/DateRangePicker"
import { AnimatedCount } from "@/components/ui/animated-count"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast-provider"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCreatePollPath, normalizeNextPath } from "@/lib/auth/supabase-auth"
import { upsertTrackedPoll } from "@/lib/date-poll/tracked-polls"
import {
  MAX_POLL_DESCRIPTION_LENGTH,
  MAX_POLL_OPTIONS,
  MAX_POLL_TITLE_LENGTH,
  MIN_POLL_OPTIONS,
} from "@/lib/date-poll/validation"
import { useFlipListAnimation } from "@/lib/use-flip-list-animation"

type CreateResult = {
  pollId: string
  path: string
}

function normalizeDateRange(range: DateRange | undefined): { start: Date; end: Date } | null {
  if (!range?.from) return null

  const from = startOfDay(range.from)
  const to = startOfDay(range.to ?? range.from)

  if (from <= to) {
    return { start: from, end: to }
  }

  return { start: to, end: from }
}

function rangeToDateOptions(range: { start: Date; end: Date }): string[] {
  return eachDayOfInterval({ start: range.start, end: range.end }).map((date) =>
    formatISO(date, { representation: "date" })
  )
}

function sortDateOptions(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => Date.parse(a) - Date.parse(b))
}

export function CreatePollForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [pendingRange, setPendingRange] = useState<DateRange>()
  const [options, setOptions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const [isLoading, setIsLoading] = useState(false)

  const normalizedPendingRange = useMemo(
    () => normalizeDateRange(pendingRange),
    [pendingRange]
  )
  const pendingRangeOptions = useMemo(
    () => (normalizedPendingRange ? rangeToDateOptions(normalizedPendingRange) : []),
    [normalizedPendingRange]
  )
  const existingOptions = useMemo(() => new Set(options), [options])
  const existingOptionDayKeys = useMemo(() => {
    const dayKeys = new Set<number>()

    for (const option of options) {
      const parsed = new Date(`${option}T00:00:00`)
      if (Number.isNaN(parsed.getTime())) continue
      dayKeys.add(startOfDay(parsed).getTime())
    }

    return dayKeys
  }, [options])
  const pendingRangeNewOptions = useMemo(
    () => pendingRangeOptions.filter((option) => !existingOptions.has(option)),
    [existingOptions, pendingRangeOptions]
  )
  const previewOptionCount = options.length + pendingRangeNewOptions.length
  const exceedsMaxOptions = previewOptionCount > MAX_POLL_OPTIONS
  const hasPendingRange = normalizedPendingRange !== null
  const bindOptionBadgeRef = useFlipListAnimation(options)

  const shareUrl = useMemo(() => {
    if (!result) return ""
    if (typeof window === "undefined") return result.path
    return `${window.location.origin}${result.path}`
  }, [result])

  useEffect(() => {
    if (copyState === "idle") return

    const timeout = window.setTimeout(() => setCopyState("idle"), 1800)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  async function copyShareUrl() {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState("copied")
      toast({
        variant: "success",
        title: "Copied",
        description: "Share link copied to clipboard.",
      })
    } catch {
      setCopyState("failed")
      toast({
        variant: "error",
        title: "Copy failed",
        description: "Could not copy the share link.",
      })
    }
  }

  function addPendingTimeSpan() {
    setError(null)
    setResult(null)

    if (!normalizedPendingRange) {
      toast({
        variant: "error",
        title: "Missing timespan",
        description: "Select a date range or single day first.",
      })
      return
    }

    if (pendingRangeNewOptions.length === 0) {
      toast({
        title: "No new dates added",
        description: "All dates in this timespan are already selected.",
      })
      return
    }

    const nextOptions = sortDateOptions([...options, ...pendingRangeNewOptions])
    if (nextOptions.length > MAX_POLL_OPTIONS) {
      const message = `You can select up to ${MAX_POLL_OPTIONS} dates per poll.`
      setError(message)
      toast({
        variant: "error",
        title: "Too many dates",
        description: message,
      })
      return
    }

    setOptions(nextOptions)
    setPendingRange(undefined)
    toast({
      variant: "success",
      title: "Timespan added",
      description: `Added ${pendingRangeNewOptions.length} date${pendingRangeNewOptions.length === 1 ? "" : "s"}.`,
    })
  }

  function removeDateOption(option: string) {
    setError(null)
    setResult(null)
    setOptions((current) => current.filter((value) => value !== option))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)

    if (options.length > MAX_POLL_OPTIONS) {
      const message = `You can select up to ${MAX_POLL_OPTIONS} dates per poll.`
      setError(message)
      toast({
        variant: "error",
        title: "Too many dates",
        description: message,
      })
      return
    }

    if (options.length < MIN_POLL_OPTIONS) {
      const message = `Select at least ${MIN_POLL_OPTIONS} dates before creating the poll`
      setError(message)
      toast({
        variant: "error",
        title: "Not enough dates",
        description: message,
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, options }),
      })

      const payload = (await response.json()) as
        | { error?: string; errors?: string[] }
        | { pollId: string; path: string }

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(normalizeNextPath(getCreatePollPath()))}`)
          return
        }

        if ("errors" in payload && payload.errors?.length) {
          setError(payload.errors.join(". "))
          toast({
            variant: "error",
            title: "Could not create poll",
            description: payload.errors.join(". "),
          })
        } else {
          const message = ("error" in payload ? payload.error : undefined) ?? "Could not create poll"
          setError(message)
          toast({
            variant: "error",
            title: "Could not create poll",
            description: message,
          })
        }
        return
      }

      if (!("pollId" in payload)) {
        setError("Could not create poll")
        toast({
          variant: "error",
          title: "Could not create poll",
          description: "The server response was incomplete.",
        })
        return
      }

      const createdPoll = payload
      setResult(createdPoll)
      upsertTrackedPoll({
        id: createdPoll.pollId,
        title: title.trim() || "Untitled poll",
        path: createdPoll.path,
        role: "organizer",
      })
      toast({
        variant: "success",
        title: "Poll created",
        description: "Your poll is ready to share.",
      })
    } catch {
      setError("Could not create poll")
      toast({
        variant: "error",
        title: "Could not create poll",
        description: "Please try again in a moment.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8 app-enter">
        <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              New poll
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create Date Poll</h1>
            <p className="text-muted-foreground max-w-xl text-sm">
              Add one or more timespans and we generate one poll option per day.
            </p>
          </div>
          <div className="bg-background/80 text-muted-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
            <CalendarDays className="size-4 shrink-0" />
            <span>
              <AnimatedCount value={options.length} /> date option
              {options.length === 1 ? "" : "s"} selected
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden app-enter-soft">
          <CardHeader className="border-b">
            <CardTitle>Poll details</CardTitle>
            <CardDescription>
              Define title/context and add one or more timespans.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="title">
                  Title
                </label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Date Poll"
                  maxLength={MAX_POLL_TITLE_LENGTH}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="description">
                  Description (optional)
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Any trip context for participants"
                  maxLength={MAX_POLL_DESCRIPTION_LENGTH}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add timespan</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <DateRangePicker
                      value={pendingRange}
                      onChange={setPendingRange}
                      disabled={(date) =>
                        existingOptionDayKeys.has(startOfDay(date).getTime())
                      }
                      placeholder="Select range or day"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={!hasPendingRange || exceedsMaxOptions}
                    onClick={addPendingTimeSpan}
                  >
                    <Plus className="size-4" />
                    Add timespan
                  </Button>
                </div>
                {hasPendingRange ? (
                  exceedsMaxOptions ? (
                    <p className="text-xs text-destructive">
                      Adding this timespan would exceed the maximum of{" "}
                      <AnimatedCount value={MAX_POLL_OPTIONS} /> dates.
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      This timespan includes <AnimatedCount value={pendingRangeOptions.length} /> date
                      {pendingRangeOptions.length === 1 ? "" : "s"}, with{" "}
                      <AnimatedCount value={pendingRangeNewOptions.length} /> new date
                      {pendingRangeNewOptions.length === 1 ? "" : "s"}.
                    </p>
                  )
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Pick a range or single day, then click Add timespan.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Selected dates: <AnimatedCount value={options.length} /> /{" "}
                  <AnimatedCount value={MAX_POLL_OPTIONS} />
                </p>
              </div>

              {error ? <p className="text-sm text-destructive app-enter-scale">{error}</p> : null}

              {!result ? (
                <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                  <Plus className="size-4" />
                  {isLoading ? "Creating..." : "Create poll"}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden app-enter-soft">
          <CardHeader className="border-b">
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              Review selected dates, remove any with `x`, and share after creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {options.length > 0 ? (
              <div className="max-h-56 overflow-auto rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-xs">Use `x` on a chip to remove a date.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={options.length === 0}
                    onClick={() => {
                      setResult(null)
                      setOptions([])
                    }}
                  >
                    Clear all
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <span
                      key={option}
                      ref={bindOptionBadgeRef(option)}
                      className="motion-safe:will-change-transform"
                    >
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs">
                        <span>{option}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${option}`}
                          className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-full p-0.5 transition-colors"
                          onClick={() => removeDateOption(option)}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
                Add at least one timespan to generate date options.
              </div>
            )}

            {result ? (
              <div className="space-y-2 rounded-lg border p-3 app-enter-scale">
                <p className="text-sm font-medium">Share</p>
                <TooltipProvider>
                  <div className="flex flex-col gap-2">
                    <Input readOnly value={shareUrl} className="text-xs" aria-label="Share link" />
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label="Go to poll"
                            onClick={() => router.push(result.path)}
                          >
                            <ArrowRight className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open the poll page</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label="Copy link"
                            onClick={copyShareUrl}
                          >
                            {copyState === "copied" ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copyState === "copied"
                            ? "Link copied"
                            : copyState === "failed"
                              ? "Could not copy link"
                              : "Copy share link"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </TooltipProvider>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Share link appears here once the poll is created.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
