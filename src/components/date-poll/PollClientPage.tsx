"use client"

import { startOfDay } from "date-fns"
import { BarChart3, Eraser, Loader2, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-poll/DateRangePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { upsertTrackedPoll } from "@/lib/date-poll/tracked-polls"
import type { PollView, VoteStatus } from "@/lib/date-poll/types"

type VotePayload = {
  poll: PollView
}

type PollClientPageProps = {
  initialPoll: PollView
  initialFullName?: string
  initialVotes?: Record<string, VoteStatus>
}

const VOTE_LABELS: Record<VoteStatus, string> = {
  can: "can",
  maybe: "maybe",
  cant: "can't",
}

function formatOption(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(parsedDate)
}

export function PollClientPage({ initialPoll, initialFullName, initialVotes }: PollClientPageProps) {
  const router = useRouter()
  const poll = initialPoll

  const [fullName, setFullName] = useState(initialFullName ?? "")
  const [votes, setVotes] = useState<Record<string, VoteStatus>>(initialVotes ?? {})
  const [selectedRange, setSelectedRange] = useState<DateRange>()
  const [rangeStatus, setRangeStatus] = useState<VoteStatus>("can")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const optionsByDate = useMemo(
    () =>
      [...poll.options].sort(
        (a, b) => new Date(a.value).getTime() - new Date(b.value).getTime()
      ),
    [poll.options]
  )

  const organizerTimespan = useMemo(() => {
    const dates = optionsByDate
      .map((option) => new Date(option.value))
      .filter((date) => !Number.isNaN(date.getTime()))

    if (dates.length === 0) return null

    return {
      from: startOfDay(dates[0]),
      to: startOfDay(dates[dates.length - 1]),
    }
  }, [optionsByDate])

  const voteSummary = useMemo(() => {
    let can = 0
    let maybe = 0
    let cant = 0

    for (const option of poll.options) {
      const vote = votes[option.id]
      if (vote === "can") can += 1
      if (vote === "maybe") maybe += 1
      if (vote === "cant") cant += 1
    }

    return { can, maybe, cant }
  }, [poll.options, votes])

  const isCompleteVote = useMemo(
    () => poll.options.every((option) => votes[option.id]),
    [poll.options, votes]
  )

  useEffect(() => {
    upsertTrackedPoll({
      id: poll.id,
      title: poll.title,
      path: `/poll/${poll.id}`,
      role: "participant",
    })
  }, [poll.id, poll.title])

  function setVote(optionId: string, status: VoteStatus) {
    setVotes((prev) => ({ ...prev, [optionId]: status }))
  }

  const rangeOptionIds = useMemo(() => {
    if (!selectedRange?.from) {
      return []
    }

    const from = startOfDay(selectedRange.from)
    const to = startOfDay(selectedRange.to ?? selectedRange.from)
    const start = from <= to ? from : to
    const end = from <= to ? to : from

    return poll.options
      .filter((option) => {
        const optionDate = new Date(option.value)
        if (Number.isNaN(optionDate.getTime())) return false

        const day = startOfDay(optionDate)
        return day >= start && day <= end
      })
      .map((option) => option.id)
  }, [poll.options, selectedRange])

  useEffect(() => {
    if (rangeOptionIds.length === 0) {
      return
    }

    setVotes((prev) => {
      let hasChange = false
      const next = { ...prev }

      for (const optionId of rangeOptionIds) {
        if (next[optionId] !== rangeStatus) {
          next[optionId] = rangeStatus
          hasChange = true
        }
      }

      return hasChange ? next : prev
    })
    setError(null)
  }, [rangeOptionIds, rangeStatus])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError("Full name is required")
      return
    }

    if (!isCompleteVote) {
      setError("Choose one status for every date option")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, votes }),
      })

      const payload = (await response.json()) as
        | { error?: string; errors?: string[] }
        | VotePayload

      if (!response.ok) {
        if ("errors" in payload && payload.errors?.length) {
          setError(payload.errors.join(". "))
        } else {
          setError(("error" in payload ? payload.error : undefined) ?? "Vote submission failed")
        }
        return
      }

      if (!("poll" in payload)) {
        setError("Vote submission failed")
        return
      }

      const updatedPoll = payload.poll
      upsertTrackedPoll({
        id: updatedPoll.id,
        title: updatedPoll.title,
        path: `/poll/${updatedPoll.id}`,
        role: "participant",
      })

      router.push(`/poll/${updatedPoll.id}/results`)
      router.refresh()
    } catch {
      setError("Vote submission failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{poll.title}</CardTitle>
          {poll.description ? <CardDescription>{poll.description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Set availability for a range</p>
                <p className="text-muted-foreground text-xs">
                  1. pick a range, 2. Choose a status. It is applied automatically.
                </p>
                <p className="text-muted-foreground text-xs">
                  Organizer timespan:{" "}
                  {organizerTimespan
                    ? `${formatOption(organizerTimespan.from.toISOString().slice(0, 10))} - ${formatOption(
                        organizerTimespan.to.toISOString().slice(0, 10)
                      )}`
                    : "not available"}
                </p>
              </div>

              <DateRangePicker
                value={selectedRange}
                onChange={setSelectedRange}
                fromDate={organizerTimespan?.from}
                toDate={organizerTimespan?.to}
                defaultMonth={organizerTimespan?.from}
                numberOfMonths={2}
                placeholder="Select available range (or a single day)"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={rangeStatus === "can" ? "default" : "outline"}
                  onClick={() => setRangeStatus("can")}
                >
                  ✅ can
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={rangeStatus === "maybe" ? "default" : "outline"}
                  onClick={() => setRangeStatus("maybe")}
                >
                  ⚠️ maybe
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={rangeStatus === "cant" ? "default" : "outline"}
                  onClick={() => setRangeStatus("cant")}
                >
                  ❌ can&apos;t
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedRange(undefined)
                    setVotes({})
                    setRangeStatus("can")
                    setError(null)
                  }}
                >
                  <Eraser className="size-3.5" />
                  Clear
                </Button>
              </div>

              {selectedRange?.from ? (
                <p className="text-muted-foreground text-xs">
                  Auto-applied{" "}
                  {rangeStatus === "can" ? "✅ can" : rangeStatus === "maybe" ? "⚠️ maybe" : "❌ can't"}{" "}
                  to {rangeOptionIds.length} {rangeOptionIds.length === 1 ? "date" : "dates"} in the selected range.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">✅ {voteSummary.can}</Badge>
                <Badge variant="outline">⚠️ {voteSummary.maybe}</Badge>
                <Badge variant="outline">❌ {voteSummary.cant}</Badge>
              </div>

              <p className="text-muted-foreground text-xs">
                Tip: select a single date or a longer range, then fine-tune below if needed.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Fine-tune individual dates</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date option</TableHead>
                  <TableHead>Your vote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optionsByDate.map((option) => (
                  <TableRow key={option.id}>
                    <TableCell>{formatOption(option.value)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {(["can", "maybe", "cant"] as const).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={votes[option.id] === status ? "default" : "outline"}
                            onClick={() => setVote(option.id, status)}
                          >
                            {status === "can" ? "✅" : status === "maybe" ? "⚠️" : "❌"} {VOTE_LABELS[status]}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fullName">
                Full name
              </label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Max Mustermann"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Submit
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/poll/${poll.id}/results`}>
                  <BarChart3 className="size-4" />
                  View results
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
