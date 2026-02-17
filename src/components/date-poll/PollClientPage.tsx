"use client"

import { startOfDay } from "date-fns"
import { BarChart3, Eraser, Loader2, PencilLine, Send, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"

import { DateRangePicker } from "@/components/date-poll/DateRangePicker"
import {
  VOTE_STATUS_LABEL,
  VOTE_STATUS_ORDER,
  VoteStatusIcon,
} from "@/components/date-poll/vote-status-ui"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatPollOptionLabel,
  getPollOptionLocalDay,
  getPollOptionTimestamp,
  parsePollOptionDate,
} from "@/lib/date-poll/date-utils"
import { upsertTrackedPoll } from "@/lib/date-poll/tracked-polls"
import type { PollView, VoteStatus } from "@/lib/date-poll/types"

type VotePayload = {
  poll: PollView
}

type PollClientPageProps = {
  initialPoll: PollView
  initialFullName?: string
  initialVotes?: Record<string, VoteStatus>
  initialCanViewResults?: boolean
  initialError?: string | null
}

const VOTE_ACTION_LABELS: Record<VoteStatus, string> = {
  can: "Set can",
  maybe: "Set maybe",
  cant: "Set can't",
}

export function PollClientPage({
  initialPoll,
  initialFullName,
  initialVotes,
  initialCanViewResults = false,
  initialError = null,
}: PollClientPageProps) {
  const router = useRouter()
  const poll = initialPoll

  const [fullName, setFullName] = useState(initialFullName ?? "")
  const [votes, setVotes] = useState<Record<string, VoteStatus>>(initialVotes ?? {})
  const [selectedRange, setSelectedRange] = useState<DateRange>()
  const [rangeStatus, setRangeStatus] = useState<VoteStatus | null>(null)
  const [error, setError] = useState<string | null>(initialError)
  const [isLoading, setIsLoading] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isAutoFillDialogOpen, setIsAutoFillDialogOpen] = useState(false)
  const [autoFillStatus, setAutoFillStatus] = useState<VoteStatus | null>(null)
  const [canViewResults, setCanViewResults] = useState(initialCanViewResults)

  const optionsByDate = useMemo(() => {
    return [...poll.options].sort((a, b) => {
      const timeA = getPollOptionTimestamp(a.value)
      const timeB = getPollOptionTimestamp(b.value)
      const aIsValid = !Number.isNaN(timeA)
      const bIsValid = !Number.isNaN(timeB)

      if (aIsValid && bIsValid) return timeA - timeB
      if (aIsValid) return -1
      if (bIsValid) return 1
      return a.value.localeCompare(b.value)
    })
  }, [poll.options])

  const organizerTimespan = useMemo(() => {
    const dates = optionsByDate
      .map((option) => parsePollOptionDate(option.value))
      .filter((date): date is Date => date !== null)

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

  const missingOptionIds = useMemo(
    () => poll.options.filter((option) => !votes[option.id]).map((option) => option.id),
    [poll.options, votes]
  )
  const isCompleteVote = missingOptionIds.length === 0
  const hasAnyVoteSelection = useMemo(
    () => poll.options.some((option) => Boolean(votes[option.id])),
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
        const day = getPollOptionLocalDay(option.value)
        if (!day) return false
        return day >= start && day <= end
      })
      .map((option) => option.id)
  }, [poll.options, selectedRange])

  useEffect(() => {
    if (rangeOptionIds.length === 0 || !rangeStatus) {
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

  async function submitVotes(nextVotes: Record<string, VoteStatus>) {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, votes: nextVotes }),
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

      setCanViewResults(true)
      router.push(`/poll/${updatedPoll.id}/results`)
      router.refresh()
    } catch {
      setError("Vote submission failed")
    } finally {
      setIsLoading(false)
    }
  }

  function buildVotesWithMissingStatus(status: VoteStatus): Record<string, VoteStatus> {
    const nextVotes = { ...votes }
    for (const optionId of missingOptionIds) {
      nextVotes[optionId] = status
    }
    return nextVotes
  }

  function applyMissingStatus(status: VoteStatus): Record<string, VoteStatus> {
    const nextVotes = buildVotesWithMissingStatus(status)
    setVotes(nextVotes)
    setError(null)
    return nextVotes
  }

  function applyAndKeepEditing() {
    if (!autoFillStatus || missingOptionIds.length === 0 || isLoading) return

    applyMissingStatus(autoFillStatus)
    setAutoFillStatus(null)
    setIsAutoFillDialogOpen(false)
  }

  function applyAndSend() {
    if (!autoFillStatus || missingOptionIds.length === 0 || isLoading) return

    const nextVotes = applyMissingStatus(autoFillStatus)
    setAutoFillStatus(null)
    setIsAutoFillDialogOpen(false)
    void submitVotes(nextVotes)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError("Full name is required")
      return
    }

    if (missingOptionIds.length > 0) {
      setAutoFillStatus(null)
      setIsAutoFillDialogOpen(true)
      return
    }

    await submitVotes(votes)
  }

  function clearAllVotes() {
    setSelectedRange(undefined)
    setVotes({})
    setRangeStatus(null)
    setError(null)
    setIsClearDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              Poll
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{poll.title}</h1>
            {poll.description ? (
              <p className="text-muted-foreground max-w-2xl text-sm">{poll.description}</p>
            ) : (
              <p className="text-muted-foreground max-w-2xl text-sm">
                Set your availability and submit your vote.
              </p>
            )}
          </div>
          {canViewResults ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
              <Link href={`/poll/${poll.id}/results`}>
                <BarChart3 className="size-4" />
                View results
              </Link>
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full sm:w-auto">
                    <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
                      <BarChart3 className="size-4" />
                      View results
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Submit your vote to unlock results.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">Dates: {poll.options.length}</Badge>
          {VOTE_STATUS_ORDER.map((status) => (
            <Badge key={status} variant="secondary">
              <VoteStatusIcon status={status} className="size-3.5" />
              {voteSummary[status]}
            </Badge>
          ))}
          <Badge variant="secondary">{isCompleteVote ? "Ready to submit" : "Incomplete vote"}</Badge>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Set availability</CardTitle>
          <CardDescription>Use range selection first, then fine-tune individual dates.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TooltipProvider>
            <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Set availability for a range</p>
                    <p className="text-muted-foreground text-xs">
                      1. Pick a range. 2. Choose a status. It is applied automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <DateRangePicker
                        value={selectedRange}
                        onChange={setSelectedRange}
                        fromDate={organizerTimespan?.from}
                        toDate={organizerTimespan?.to}
                        defaultMonth={organizerTimespan?.from}
                        numberOfMonths={2}
                        placeholder="Select available range (or a single day)"
                      />
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Clear selected range"
                            disabled={!selectedRange?.from}
                            onClick={() => {
                              setSelectedRange(undefined)
                              setRangeStatus(null)
                              setError(null)
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {selectedRange?.from ? "Clear selected range" : "Select a range first"}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {VOTE_STATUS_ORDER.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        variant={rangeStatus === status ? "default" : "outline"}
                        onClick={() => setRangeStatus(status)}
                      >
                        <VoteStatusIcon status={status} className="size-3.5" />
                        {VOTE_STATUS_LABEL[status]}
                      </Button>
                    ))}
                  </div>

                  {selectedRange?.from ? (
                    <p className="text-muted-foreground text-xs">
                      {rangeStatus ? (
                        <>
                          Auto-applied{" "}
                          <span className="inline-flex items-center gap-1 align-middle">
                            <VoteStatusIcon status={rangeStatus} className="size-3.5" />
                            {VOTE_STATUS_LABEL[rangeStatus]}
                          </span>{" "}
                          to {rangeOptionIds.length} {rangeOptionIds.length === 1 ? "date" : "dates"} in the selected
                          range.
                        </>
                      ) : (
                        "Choose a status to apply it to the selected range."
                      )}
                    </p>
                  ) : null}

                  <p className="text-muted-foreground text-xs">
                    Tip: select a single date or a longer range, then fine-tune below if needed.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Fine-tune individual dates</p>
                  <div className="overflow-hidden rounded-xl border">
                    <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[56%]">Date option</TableHead>
                          <TableHead className="text-right">Your vote</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {optionsByDate.map((option) => {
                          const optionLabel = formatPollOptionLabel(option.value)

                          return (
                            <TableRow key={option.id}>
                              <TableCell className="whitespace-normal">{optionLabel}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {(["can", "maybe", "cant"] as const).map((status) => {
                                    return (
                                      <Tooltip key={status}>
                                        <TooltipTrigger asChild>
                                          <Button
                                            type="button"
                                            size="icon-sm"
                                            className="size-8 sm:size-9"
                                            aria-label={`${VOTE_ACTION_LABELS[status]} for ${optionLabel}`}
                                            variant={votes[option.id] === status ? "default" : "outline"}
                                            onClick={() => setVote(option.id, status)}
                                          >
                                            <VoteStatusIcon status={status} className="size-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{VOTE_ACTION_LABELS[status]}</TooltipContent>
                                      </Tooltip>
                                    )
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Current vote</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Clear all selected dates"
                            disabled={!hasAnyVoteSelection}
                            onClick={() => setIsClearDialogOpen(true)}
                          >
                            <Eraser className="size-3.5" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Clear all selected dates</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {VOTE_STATUS_ORDER.map((status) => (
                      <Badge key={status} variant="outline">
                        <VoteStatusIcon status={status} className="size-3.5" />
                        {voteSummary[status]}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-3 text-xs">
                    {isCompleteVote
                      ? "All dates are selected. You can submit now."
                      : "Select one status for each date option before submitting."}
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border p-4">
                  <label className="text-sm font-medium" htmlFor="fullName">
                    Full name
                  </label>
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Submit vote
                      </>
                    )}
                  </Button>
                  {canViewResults ? (
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <Link href={`/poll/${poll.id}/results`}>
                        <BarChart3 className="size-4" />
                        View results
                      </Link>
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <Button type="button" variant="outline" className="w-full" disabled>
                            <BarChart3 className="size-4" />
                            View results
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Submit your vote to unlock results.</TooltipContent>
                    </Tooltip>
                  )}
                  {!canViewResults ? (
                    <p className="text-muted-foreground text-xs">Submit your vote to unlock results.</p>
                  ) : null}
                </div>
              </div>
            </form>

            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear all selected dates?</DialogTitle>
                  <DialogDescription>
                    This will remove all selected availability statuses for every date.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsClearDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="destructive" onClick={clearAllVotes}>
                    Clear all dates
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isAutoFillDialogOpen}
              onOpenChange={(open) => {
                if (!isLoading) {
                  if (!open) {
                    setAutoFillStatus(null)
                  }
                  setIsAutoFillDialogOpen(open)
                }
              }}
            >
              <DialogContent showCloseButton={!isLoading}>
                <DialogHeader>
                  <DialogTitle>Finish unselected dates?</DialogTitle>
                  <DialogDescription>
                    You still have {missingOptionIds.length} unselected{" "}
                    {missingOptionIds.length === 1 ? "date" : "dates"}. Choose a status first, then decide
                    whether to keep editing or send immediately.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2 sm:grid-cols-3">
                  {VOTE_STATUS_ORDER.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={autoFillStatus === status ? "default" : "outline"}
                      disabled={isLoading}
                      onClick={() => setAutoFillStatus(status)}
                    >
                      <VoteStatusIcon status={status} className="size-4" />
                      Mark as {VOTE_STATUS_LABEL[status]}
                    </Button>
                  ))}
                </div>
                {!autoFillStatus ? (
                  <p className="text-muted-foreground text-xs">
                    Select one status to enable the apply actions.
                  </p>
                ) : null}

                <DialogFooter className="flex-col sm:flex-row sm:items-center sm:[&>button:first-child]:mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLoading || !autoFillStatus}
                    onClick={applyAndKeepEditing}
                  >
                    <PencilLine className="size-4" />
                    Apply and keep editing
                  </Button>
                  <Button
                    type="button"
                    disabled={isLoading || !autoFillStatus}
                    onClick={applyAndSend}
                  >
                    <Send className="size-4" />
                    Apply and send
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  )
}
