"use client"

import { eachDayOfInterval, formatISO, startOfDay } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-poll/DateRangePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    <Card>
      <CardHeader>
        <CardTitle>Create Date Poll</CardTitle>
        <CardDescription>Pick a date range and we generate one poll option per day.</CardDescription>
      </CardHeader>
      <CardContent>
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
            {options.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                  <Badge key={option} variant="outline">
                    {option}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create poll"}
          </Button>
        </form>

        {result ? (
          <div className="mt-6 space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Shareable URL</p>
            <Input readOnly value={shareUrl} />
            <Link className="text-sm underline" href={result.path}>
              Open poll
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
