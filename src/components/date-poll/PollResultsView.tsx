"use client"

import { Loader2, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import {
  VOTE_STATUS_ARIA_LABEL,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PollView, VoteStatus } from "@/lib/date-poll/types"

const DAY_IN_MS = 24 * 60 * 60 * 1000
const CONSECUTIVE_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
})

function formatOption(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
  }).format(parsedDate)
}

function optionsByDate(poll: PollView): PollView["options"] {
  return [...poll.options].sort(
    (a, b) => new Date(a.value).getTime() - new Date(b.value).getTime()
  )
}

function getLocalDayKey(value: string): number | null {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return null

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  ).getTime()
}

type ConsecutiveRange = {
  startDay: number
  endDay: number
  count: number
}

type ConsecutiveGroup = {
  groupNumber: number
  range: ConsecutiveRange
}

function toConsecutiveRanges(dayKeys: number[]): ConsecutiveRange[] {
  if (dayKeys.length === 0) return []

  const ranges: ConsecutiveRange[] = []
  let rangeStart = dayKeys[0]
  let previousDay = dayKeys[0]

  for (let index = 1; index < dayKeys.length; index += 1) {
    const currentDay = dayKeys[index]
    if (currentDay - previousDay === DAY_IN_MS) {
      previousDay = currentDay
      continue
    }

    ranges.push({
      startDay: rangeStart,
      endDay: previousDay,
      count: Math.round((previousDay - rangeStart) / DAY_IN_MS) + 1,
    })

    rangeStart = currentDay
    previousDay = currentDay
  }

  ranges.push({
    startDay: rangeStart,
    endDay: previousDay,
    count: Math.round((previousDay - rangeStart) / DAY_IN_MS) + 1,
  })

  return ranges
}

function formatConsecutiveRange(range: ConsecutiveRange): string {
  const startLabel = CONSECUTIVE_DATE_FORMATTER.format(new Date(range.startDay))
  if (range.startDay === range.endDay) {
    return startLabel
  }

  const endLabel = CONSECUTIVE_DATE_FORMATTER.format(new Date(range.endDay))
  return `${startLabel} to ${endLabel}`
}

type RemoveVoteState = {
  participantId: string
  participantName: string
} | null

export function PollResultsView({
  poll,
  canManageVotes = false,
}: {
  poll: PollView
  canManageVotes?: boolean
}) {
  const [pollState, setPollState] = useState(poll)
  const [removeVoteState, setRemoveVoteState] = useState<RemoveVoteState>(null)
  const [isRemovingVote, setIsRemovingVote] = useState(false)
  const [removeVoteError, setRemoveVoteError] = useState<string | null>(null)
  const [quickReadCount, setQuickReadCount] = useState(3)
  const sortedOptions = useMemo(() => optionsByDate(pollState), [pollState])
  const rankedOptions = useMemo(
    () =>
      [...sortedOptions]
        .map((option) => ({
          option,
          score: option.canCount * 2 + option.maybeCount,
        }))
        .sort((a, b) => b.score - a.score || b.option.canCount - a.option.canCount),
    [sortedOptions]
  )
  const quickReadMaxCount = Math.max(1, rankedOptions.length)
  const quickReadValue = Math.min(quickReadCount, quickReadMaxCount)
  const quickReadPresetValues = useMemo(() => {
    return Array.from(new Set([1, 3, 5, quickReadMaxCount])).filter(
      (value) => value <= quickReadMaxCount
    )
  }, [quickReadMaxCount])
  const displayedQuickReadOptions = useMemo(
    () => rankedOptions.slice(0, quickReadValue),
    [quickReadValue, rankedOptions]
  )
  const consecutiveRanges = useMemo(() => {
    const uniqueDayKeys = Array.from(
      new Set(
        sortedOptions
          .map((option) => getLocalDayKey(option.value))
          .filter((dayKey): dayKey is number => dayKey !== null)
      )
    ).sort((a, b) => a - b)

    return toConsecutiveRanges(uniqueDayKeys)
  }, [sortedOptions])
  const consecutiveGroups = useMemo<ConsecutiveGroup[]>(
    () =>
      consecutiveRanges.map((range, index) => ({
        groupNumber: index + 1,
        range,
      })),
    [consecutiveRanges]
  )
  const consecutiveGroupByDay = useMemo(() => {
    const dayToGroup = new Map<number, ConsecutiveGroup>()

    for (const group of consecutiveGroups) {
      for (let day = group.range.startDay; day <= group.range.endDay; day += DAY_IN_MS) {
        dayToGroup.set(day, group)
      }
    }

    return dayToGroup
  }, [consecutiveGroups])

  function updateQuickReadCount(nextCount: number) {
    const nextValue = Math.min(Math.max(nextCount, 1), quickReadMaxCount)
    if (nextValue === quickReadCount) return
    setQuickReadCount(nextValue)
  }

  function handleQuickReadSliderChange(rawValue: string) {
    const parsedValue = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsedValue)) return
    updateQuickReadCount(parsedValue)
  }

  function handleQuickReadStep(direction: "less" | "more") {
    const nextCount = direction === "less" ? quickReadValue - 1 : quickReadValue + 1
    updateQuickReadCount(nextCount)
  }

  function getConsecutiveGroupForOption(optionValue: string): ConsecutiveGroup | null {
    const dayKey = getLocalDayKey(optionValue)
    if (dayKey === null) return null
    return consecutiveGroupByDay.get(dayKey) ?? null
  }

  async function confirmRemoveVotes() {
    if (!removeVoteState || isRemovingVote) return

    setIsRemovingVote(true)
    setRemoveVoteError(null)

    try {
      const response = await fetch(
        `/api/polls/${pollState.id}/participants/${encodeURIComponent(removeVoteState.participantId)}`,
        {
          method: "DELETE",
        }
      )

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; errors?: string[] }
        | { poll?: PollView }
        | null

      if (!response.ok) {
        if (payload && "errors" in payload && payload.errors?.length) {
          setRemoveVoteError(payload.errors.join(". "))
        } else if (payload && "error" in payload && payload.error) {
          setRemoveVoteError(payload.error)
        } else {
          setRemoveVoteError("Could not remove votes")
        }
        return
      }

      if (payload && "poll" in payload && payload.poll) {
        setPollState(payload.poll)
        setRemoveVoteState(null)
      } else {
        setRemoveVoteError("Could not remove votes")
      }
    } catch {
      setRemoveVoteError("Could not remove votes")
    } finally {
      setIsRemovingVote(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle>Results overview</CardTitle>
            <CardDescription>Dates are shown in chronological order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="overflow-hidden rounded-xl border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[58%]">Option</TableHead>
                    {VOTE_STATUS_ORDER.map((status) => (
                      <TableHead key={status} className="w-14 text-center">
                        <span className="inline-flex items-center justify-center">
                          <VoteStatusIcon status={status} className="size-4" />
                          <span className="sr-only">{VOTE_STATUS_ARIA_LABEL[status]}</span>
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOptions.map((option) => {
                    const countByStatus: Record<VoteStatus, number> = {
                      can: option.canCount,
                      maybe: option.maybeCount,
                      cant: option.cantCount,
                    }

                    return (
                      <TableRow key={option.id}>
                        <TableCell className="whitespace-normal">{formatOption(option.value)}</TableCell>
                        {VOTE_STATUS_ORDER.map((status) => (
                          <TableCell key={status} className="text-center font-medium">
                            {countByStatus[status]}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Participants: {pollState.participants.length}</Badge>
              <Badge variant="outline">Options: {sortedOptions.length}</Badge>
              <Badge variant="outline">{canManageVotes ? "Organizer view" : "Participant view"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden xl:sticky xl:top-24 xl:self-start">
          <CardHeader className="border-b">
            <CardTitle>Insights</CardTitle>
            <CardDescription>Quick read of the strongest options.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            <div className="space-y-2 rounded-xl border bg-gradient-to-br from-background via-muted/25 to-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold tracking-wide uppercase">Quick read items</p>
                  <p className="text-muted-foreground text-[11px]">How many top options should be highlighted.</p>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {rankedOptions.length === 0 ? "0 / 0" : `${quickReadValue} / ${rankedOptions.length}`}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickReadPresetValues.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={quickReadValue === value ? "default" : "outline"}
                    className="h-7 px-2 text-[11px]"
                    disabled={rankedOptions.length === 0}
                    onClick={() => updateQuickReadCount(value)}
                  >
                    {value === quickReadMaxCount ? "All" : `Top ${value}`}
                  </Button>
                ))}
              </div>

              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 min-w-12 px-2 text-[11px] whitespace-nowrap"
                  disabled={rankedOptions.length === 0 || quickReadValue <= 1}
                  onClick={() => handleQuickReadStep("less")}
                >
                  Less
                </Button>
                <label htmlFor="quick-read-slider" className="sr-only">
                  Number of quick read items
                </label>
                <input
                  id="quick-read-slider"
                  type="range"
                  min={1}
                  max={quickReadMaxCount}
                  value={quickReadValue}
                  disabled={rankedOptions.length === 0}
                  onChange={(event) => handleQuickReadSliderChange(event.target.value)}
                  className="accent-primary h-1.5 w-full min-w-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 min-w-12 px-2 text-[11px] whitespace-nowrap"
                  disabled={rankedOptions.length === 0 || quickReadValue >= quickReadMaxCount}
                  onClick={() => handleQuickReadStep("more")}
                >
                  More
                </Button>
              </div>
            </div>

            {displayedQuickReadOptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No options available yet.</p>
            ) : (
              displayedQuickReadOptions.map((item, index) => (
                <div
                  key={item.option.id}
                  className="space-y-1 rounded-md border border-l-4 border-l-emerald-500/65 bg-background/80 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide uppercase">Top {index + 1}</p>
                    <span className="text-muted-foreground text-[11px]">Score {item.score}</span>
                  </div>
                  <p className="text-sm font-medium leading-tight">{formatOption(item.option.value)}</p>
                  {(() => {
                    const group = getConsecutiveGroupForOption(item.option.value)
                    if (!group) return null

                    return (
                      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          Group {group.groupNumber}
                        </Badge>
                        <span className="truncate">{formatConsecutiveRange(group.range)}</span>
                      </div>
                    )
                  })()}
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
                    {VOTE_STATUS_ORDER.map((status) => {
                      const countByStatus: Record<VoteStatus, number> = {
                        can: item.option.canCount,
                        maybe: item.option.maybeCount,
                        cant: item.option.cantCount,
                      }

                      return (
                        <span key={status} className="inline-flex items-center gap-1">
                          <VoteStatusIcon status={status} className="size-3.5" />
                          {countByStatus[status]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Who voted what</CardTitle>
          <CardDescription>Detailed vote matrix for all participants and options.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TooltipProvider>
            <div className="overflow-x-auto rounded-xl border">
              <Table className="w-full min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="md:min-w-[14rem]">Participant</TableHead>
                    {sortedOptions.map((option) => (
                      <TableHead key={option.id} className="whitespace-nowrap text-center">
                        {formatOption(option.value)}
                      </TableHead>
                    ))}
                    {canManageVotes ? <TableHead className="w-16 text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pollState.participants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={sortedOptions.length + 1 + (canManageVotes ? 1 : 0)}
                        className="text-muted-foreground"
                      >
                        No votes yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pollState.participants.map((participant) => (
                      <TableRow key={participant.id}>
                        <TableCell className="whitespace-nowrap">{participant.fullName}</TableCell>
                        {sortedOptions.map((option) => {
                          const vote = participant.votes[option.id]
                          return (
                            <TableCell key={option.id} className="whitespace-nowrap text-center">
                              {vote ? (
                                <span className="inline-flex items-center gap-1">
                                  <VoteStatusIcon status={vote} className="size-3.5" />
                                  {VOTE_STATUS_LABEL[vote]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )
                        })}
                        {canManageVotes ? (
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Remove votes from ${participant.fullName}`}
                                  onClick={() => {
                                    setRemoveVoteState({
                                      participantId: participant.id,
                                      participantName: participant.fullName,
                                    })
                                    setRemoveVoteError(null)
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove all votes</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      <Dialog
        open={removeVoteState !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingVote) {
            setRemoveVoteState(null)
            setRemoveVoteError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isRemovingVote}>
          <DialogHeader>
            <DialogTitle>Remove votes?</DialogTitle>
            <DialogDescription>
              {`Remove all votes from "${removeVoteState?.participantName ?? "this participant"}"? They can submit a new vote later.`}
            </DialogDescription>
          </DialogHeader>
          {removeVoteError ? <p className="text-sm text-destructive">{removeVoteError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isRemovingVote}
              onClick={() => setRemoveVoteState(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRemovingVote}
              onClick={confirmRemoveVotes}
            >
              {isRemovingVote ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove votes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
