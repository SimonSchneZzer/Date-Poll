"use client"

import { eachDayOfInterval, formatISO, startOfDay } from "date-fns"
import { ArrowRight, CalendarDays, Check, Copy, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-poll/DateRangePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getCreatePollPath, normalizeNextPath } from "@/lib/auth/supabase-auth"
import { upsertTrackedPoll } from "@/lib/date-poll/tracked-polls"

type CreateResult = {
  pollId: string
  path: string
}

export function CreatePollForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const [isLoading, setIsLoading] = useState(false)

  const options = useMemo(() => {
    if (!dateRange?.from || !dateRange.to) {
      return []
    }

    if (dateRange.from > dateRange.to) {
      return []
    }

    return eachDayOfInterval({
      start: startOfDay(dateRange.from),
      end: startOfDay(dateRange.to),
    }).map((date) => formatISO(date, { representation: "date" }))
  }, [dateRange])

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
    } catch {
      setCopyState("failed")
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)

    if (options.length < 2) {
      setError("Select a date range with at least two dates")
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
        } else {
          setError(("error" in payload ? payload.error : undefined) ?? "Could not create poll")
        }
        return
      }

      if (!("pollId" in payload)) {
        setError("Could not create poll")
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
    } catch {
      setError("Could not create poll")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              New poll
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create Date Poll</h1>
            <p className="text-muted-foreground max-w-xl text-sm">
              Pick a date range and we generate one poll option per day.
            </p>
          </div>
          <div className="bg-background/80 text-muted-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
            <CalendarDays className="size-4 shrink-0" />
            <span>{options.length} date option{options.length === 1 ? "" : "s"} selected</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Poll details</CardTitle>
            <CardDescription>Define title, optional context and the date range.</CardDescription>
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
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date range</label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <p className="text-muted-foreground text-xs">
                  Generated options: {options.length > 0 ? options.length : "none selected"}
                </p>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              {!result ? (
                <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                  <Plus className="size-4" />
                  {isLoading ? "Creating..." : "Create poll"}
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Overview</CardTitle>
            <CardDescription>Review generated date options and share after creation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {options.length > 0 ? (
              <div className="max-h-56 overflow-auto rounded-lg border p-3">
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <Badge key={option} variant="outline">
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
                Select a range to generate options.
              </div>
            )}

            {result ? (
              <div className="space-y-2 rounded-lg border p-3">
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
