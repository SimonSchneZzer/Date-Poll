"use client"

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileBraces,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Search,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  VOTE_STATUS_ARIA_LABEL,
  VOTE_STATUS_LABEL,
  VOTE_STATUS_ORDER,
  VoteStatusIcon,
} from "@/components/date-poll/vote-status-ui"
import { Badge } from "@/components/ui/badge"
import { AnimatedCount } from "@/components/ui/animated-count"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast-provider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatPollOptionLabel,
  formatPollOptionLabelWithWeekday,
  getPollOptionLocalDay,
  getPollOptionTimestamp,
} from "@/lib/date-poll/date-utils"
import { upsertTrackedPoll } from "@/lib/date-poll/tracked-polls"
import type { PollView, VoteStatus } from "@/lib/date-poll/types"
import { useFlipListAnimation } from "@/lib/use-flip-list-animation"
import { cn } from "@/lib/utils"

const DAY_IN_MS = 24 * 60 * 60 * 1000
const CONSECUTIVE_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "long",
})

function optionsByDate(poll: PollView): PollView["options"] {
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
}

function getLocalDayKey(value: string): number | null {
  const day = getPollOptionLocalDay(value)
  if (!day) return null
  return day.getTime()
}

type ConsecutiveRange = {
  startDay: number
  endDay: number
  count: number
}

type ConsecutiveGroup = {
  groupNumber: number
  range: ConsecutiveRange
  score: number
  minScore: number
  maxScore: number
}

type DayScore = {
  dayKey: number
  score: number
}

type RankedOption = {
  option: PollView["options"][number]
  score: number
}

type QuickReadEntry = {
  rank: number
  item: RankedOption
  group: ConsecutiveGroup | null
}

type QuickReadGroupBucket = {
  key: string
  group: ConsecutiveGroup | null
  entries: QuickReadEntry[]
}

type ConsecutiveGroupingResult = {
  groups: ConsecutiveGroup[]
  groupByDayScore: Map<string, ConsecutiveGroup>
}

type InsightsGroupingMode = "strict" | "connected"

const DEFAULT_CONNECTED_INSIGHTS_SCORE_TOLERANCE = 1
const MAX_CONNECTED_INSIGHTS_SCORE_TOLERANCE = 10

function findDayScoreRoot(parents: number[], index: number): number {
  if (parents[index] === index) return index
  parents[index] = findDayScoreRoot(parents, parents[index])
  return parents[index]
}

function mergeDayScoreRoots(parents: number[], ranks: number[], leftIndex: number, rightIndex: number) {
  const leftRoot = findDayScoreRoot(parents, leftIndex)
  const rightRoot = findDayScoreRoot(parents, rightIndex)
  if (leftRoot === rightRoot) return

  if (ranks[leftRoot] < ranks[rightRoot]) {
    parents[leftRoot] = rightRoot
    return
  }

  if (ranks[leftRoot] > ranks[rightRoot]) {
    parents[rightRoot] = leftRoot
    return
  }

  parents[rightRoot] = leftRoot
  ranks[leftRoot] += 1
}

function toConsecutiveScoreGroups(
  dayScores: DayScore[],
  scoreTolerance: number
): ConsecutiveGroupingResult {
  if (dayScores.length === 0) {
    return { groups: [], groupByDayScore: new Map() }
  }

  const normalizedTolerance = Math.max(0, Math.floor(scoreTolerance))
  const sortedDayScores = Array.from(
    new Map(dayScores.map((dayScore) => [`${dayScore.dayKey}:${dayScore.score}`, dayScore])).values()
  ).sort((a, b) => a.dayKey - b.dayKey || b.score - a.score)

  const parents = sortedDayScores.map((_, index) => index)
  const ranks = sortedDayScores.map(() => 0)
  const dayScoreIndexesByDay = new Map<number, number[]>()

  for (let index = 0; index < sortedDayScores.length; index += 1) {
    const dayScore = sortedDayScores[index]
    const existingIndexes = dayScoreIndexesByDay.get(dayScore.dayKey)
    if (existingIndexes) {
      existingIndexes.push(index)
    } else {
      dayScoreIndexesByDay.set(dayScore.dayKey, [index])
    }
  }

  for (const [dayKey, currentDayIndexes] of dayScoreIndexesByDay.entries()) {
    const nextDayIndexes = dayScoreIndexesByDay.get(dayKey + DAY_IN_MS)
    if (!nextDayIndexes) continue

    for (const currentIndex of currentDayIndexes) {
      const current = sortedDayScores[currentIndex]
      for (const nextIndex of nextDayIndexes) {
        const next = sortedDayScores[nextIndex]
        if (Math.abs(current.score - next.score) <= normalizedTolerance) {
          mergeDayScoreRoots(parents, ranks, currentIndex, nextIndex)
        }
      }
    }
  }

  const components = new Map<
    number,
    {
      dayKeys: Set<number>
      dayScoreKeys: string[]
      minScore: number
      maxScore: number
    }
  >()

  for (let index = 0; index < sortedDayScores.length; index += 1) {
    const dayScore = sortedDayScores[index]
    const root = findDayScoreRoot(parents, index)
    const existingComponent = components.get(root)
    if (existingComponent) {
      existingComponent.dayKeys.add(dayScore.dayKey)
      existingComponent.dayScoreKeys.push(`${dayScore.dayKey}:${dayScore.score}`)
      existingComponent.minScore = Math.min(existingComponent.minScore, dayScore.score)
      existingComponent.maxScore = Math.max(existingComponent.maxScore, dayScore.score)
      continue
    }

    components.set(root, {
      dayKeys: new Set([dayScore.dayKey]),
      dayScoreKeys: [`${dayScore.dayKey}:${dayScore.score}`],
      minScore: dayScore.score,
      maxScore: dayScore.score,
    })
  }

  const groupsWithKeys = Array.from(components.values())
    .map((component) => {
      const orderedDayKeys = Array.from(component.dayKeys).sort((a, b) => a - b)
      return {
        range: {
          startDay: orderedDayKeys[0],
          endDay: orderedDayKeys[orderedDayKeys.length - 1],
          count: orderedDayKeys.length,
        },
        score: component.maxScore,
        minScore: component.minScore,
        maxScore: component.maxScore,
        dayScoreKeys: component.dayScoreKeys,
      }
    })
    .sort(
      (a, b) =>
        a.range.startDay - b.range.startDay || b.score - a.score || b.range.count - a.range.count
    )
    .map((group, index) => ({
      groupNumber: index + 1,
      range: group.range,
      score: group.score,
      minScore: group.minScore,
      maxScore: group.maxScore,
      dayScoreKeys: group.dayScoreKeys,
    }))

  const groups: ConsecutiveGroup[] = []
  const groupByDayScore = new Map<string, ConsecutiveGroup>()

  for (const group of groupsWithKeys) {
    const { dayScoreKeys, ...groupWithoutKeys } = group
    groups.push(groupWithoutKeys)

    for (const dayScoreKey of dayScoreKeys) {
      groupByDayScore.set(dayScoreKey, groupWithoutKeys)
    }
  }

  return { groups, groupByDayScore }
}

function formatConsecutiveRange(range: ConsecutiveRange): string {
  const startLabel = CONSECUTIVE_DATE_FORMATTER.format(new Date(range.startDay))
  if (range.startDay === range.endDay) {
    return startLabel
  }

  const endLabel = CONSECUTIVE_DATE_FORMATTER.format(new Date(range.endDay))
  return `${startLabel} to ${endLabel}`
}

function getParticipantInitial(fullName: string): string {
  const normalized = fullName.trim()
  return normalized.charAt(0).toUpperCase() || "?"
}

function compareQuickReadEntriesByDate(entryA: QuickReadEntry, entryB: QuickReadEntry): number {
  const timestampA = getPollOptionTimestamp(entryA.item.option.value)
  const timestampB = getPollOptionTimestamp(entryB.item.option.value)
  const isTimestampAValid = !Number.isNaN(timestampA)
  const isTimestampBValid = !Number.isNaN(timestampB)

  if (isTimestampAValid && isTimestampBValid && timestampA !== timestampB) {
    return timestampA - timestampB
  }

  if (isTimestampAValid !== isTimestampBValid) {
    return isTimestampAValid ? -1 : 1
  }

  const dayKeyA = getLocalDayKey(entryA.item.option.value)
  const dayKeyB = getLocalDayKey(entryB.item.option.value)
  if (dayKeyA !== null && dayKeyB !== null && dayKeyA !== dayKeyB) {
    return dayKeyA - dayKeyB
  }

  if (dayKeyA !== null || dayKeyB !== null) {
    return dayKeyA !== null ? -1 : 1
  }

  return entryA.rank - entryB.rank
}

type RemoveVoteState = {
  participantId: string
  participantName: string
} | null

type ExportTable = {
  title: string
  headers: string[]
  rows: string[][]
}

const QUICK_READ_DEFAULT_GROUP_COUNT = 5

function sanitizeFileNamePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "export"
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function toDelimitedContent(table: ExportTable, delimiter: "," | "\t"): string {
  const header = table.headers
    .map((headerCell) => (delimiter === "," ? escapeCsvCell(headerCell) : headerCell))
    .join(delimiter)
  const rows = table.rows.map((row) =>
    row
      .map((cell) => (delimiter === "," ? escapeCsvCell(cell) : cell.replaceAll("\t", " ").replaceAll("\n", " ")))
      .join(delimiter)
  )

  return [header, ...rows].join("\n")
}

function toJsonContent(table: ExportTable): string {
  const values = table.rows.map((row) => {
    const record: Record<string, string> = {}
    for (let index = 0; index < table.headers.length; index += 1) {
      record[table.headers[index]] = row[index] ?? ""
    }
    return record
  })

  return JSON.stringify(values, null, 2)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function toExcelHtmlContent(table: ExportTable): string {
  const headerHtml = table.headers.map((headerCell) => `<th>${escapeHtml(headerCell)}</th>`).join("")
  const bodyHtml = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(table.title)}</title>
  </head>
  <body>
    <table border="1">
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </body>
</html>`
}

function downloadFile(args: { fileName: string; mimeType: string; content: string }) {
  const blob = new Blob([args.content], { type: args.mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = args.fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function printTableAsPdf(table: ExportTable) {
  const headerHtml = table.headers.map((headerCell) => `<th>${escapeHtml(headerCell)}</th>`).join("")
  const bodyHtml = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("")
  const content = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(table.title)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #f4f4f5; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(table.title)}</h1>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`

  const printWindow = window.open("", "_blank", "noopener,noreferrer")
  if (!printWindow) return

  printWindow.document.open()
  printWindow.document.write(content)
  printWindow.document.close()
}

function TableExportMenu({
  table,
  fileBaseName,
  triggerClassName,
  onExport,
}: {
  table: ExportTable
  fileBaseName: string
  triggerClassName?: string
  onExport?: (message: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm", triggerClassName)}
        >
          <Download className="size-4" />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-1 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            printTableAsPdf(table)
            onExport?.("Opened print dialog for PDF export.")
          }}
        >
          <Printer className="size-4" />
          PDF (Print)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            downloadFile({
              fileName: `${fileBaseName}.xls`,
              mimeType: "application/vnd.ms-excel;charset=utf-8",
              content: "\uFEFF" + toExcelHtmlContent(table),
            })
            onExport?.("Downloaded Excel file.")
          }}
        >
          <FileSpreadsheet className="size-4" />
          Excel (.xls)
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            downloadFile({
              fileName: `${fileBaseName}.csv`,
              mimeType: "text/csv;charset=utf-8",
              content: "\uFEFF" + toDelimitedContent(table, ","),
            })
            onExport?.("Downloaded CSV file.")
          }}
        >
          <FileText className="size-4" />
          CSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            downloadFile({
              fileName: `${fileBaseName}.tsv`,
              mimeType: "text/tab-separated-values;charset=utf-8",
              content: toDelimitedContent(table, "\t"),
            })
            onExport?.("Downloaded TSV file.")
          }}
        >
          <FileText className="size-4" />
          TSV
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            downloadFile({
              fileName: `${fileBaseName}.json`,
              mimeType: "application/json;charset=utf-8",
              content: toJsonContent(table),
            })
            onExport?.("Downloaded JSON file.")
          }}
        >
          <FileBraces className="size-4" />
          JSON
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function PollResultsView({
  poll,
  canManageVotes = false,
}: {
  poll: PollView
  canManageVotes?: boolean
}) {
  const { toast } = useToast()
  const [pollState, setPollState] = useState(poll)
  const [removeVoteState, setRemoveVoteState] = useState<RemoveVoteState>(null)
  const [isRemovingVote, setIsRemovingVote] = useState(false)
  const [removeVoteError, setRemoveVoteError] = useState<string | null>(null)
  const [quickReadGroupCount, setQuickReadGroupCount] = useState(QUICK_READ_DEFAULT_GROUP_COUNT)
  const [insightsGroupingMode, setInsightsGroupingMode] = useState<InsightsGroupingMode>("strict")
  const [connectedScoreTolerance, setConnectedScoreTolerance] = useState(
    DEFAULT_CONNECTED_INSIGHTS_SCORE_TOLERANCE
  )
  const [participantQuery, setParticipantQuery] = useState("")
  const [isParticipantColumnCollapsed, setIsParticipantColumnCollapsed] = useState(false)

  useEffect(() => {
    upsertTrackedPoll({
      id: poll.id,
      title: poll.title,
      path: `/poll/${poll.id}/results`,
      role: canManageVotes ? "organizer" : "participant",
    })
  }, [canManageVotes, poll.id, poll.title])

  const sortedOptions = useMemo(() => optionsByDate(pollState), [pollState])
  const normalizedParticipantQuery = participantQuery.trim().toLocaleLowerCase()
  const filteredParticipants = useMemo(() => {
    if (!normalizedParticipantQuery) {
      return pollState.participants
    }

    return pollState.participants.filter((participant) =>
      participant.fullName.toLocaleLowerCase().includes(normalizedParticipantQuery)
    )
  }, [normalizedParticipantQuery, pollState.participants])
  const filteredParticipantIds = useMemo(
    () => filteredParticipants.map((participant) => participant.id),
    [filteredParticipants]
  )
  const bindParticipantRowRef = useFlipListAnimation(filteredParticipantIds)
  const rankedOptions = useMemo<RankedOption[]>(
    () =>
      [...sortedOptions]
        .map((option) => ({
          option,
          score: option.canCount * 2 + option.maybeCount,
        }))
        .sort((a, b) => b.score - a.score || b.option.canCount - a.option.canCount),
    [sortedOptions]
  )
  const highestScore = rankedOptions.length > 0 ? rankedOptions[0].score : null
  const dayScores = useMemo<DayScore[]>(() => {
    const uniqueDayScores = new Set<string>()
    const values: DayScore[] = []

    for (const option of sortedOptions) {
      const dayKey = getLocalDayKey(option.value)
      if (dayKey === null) continue

      const score = option.canCount * 2 + option.maybeCount
      const key = `${dayKey}:${score}`
      if (uniqueDayScores.has(key)) {
        continue
      }

      uniqueDayScores.add(key)
      values.push({ dayKey, score })
    }

    return values.sort((a, b) => a.dayKey - b.dayKey || b.score - a.score)
  }, [sortedOptions])
  const insightsScoreTolerance =
    insightsGroupingMode === "connected" ? connectedScoreTolerance : 0
  const consecutiveGrouping = useMemo<ConsecutiveGroupingResult>(
    () => toConsecutiveScoreGroups(dayScores, insightsScoreTolerance),
    [dayScores, insightsScoreTolerance]
  )
  const consecutiveGroupByDayScore = consecutiveGrouping.groupByDayScore
  const allQuickReadGroups = useMemo<QuickReadGroupBucket[]>(() => {
    const entries: QuickReadEntry[] = rankedOptions.map((item, index) => ({
      rank: index + 1,
      item,
      group: (() => {
        const dayKey = getLocalDayKey(item.option.value)
        if (dayKey === null) return null
        return consecutiveGroupByDayScore.get(`${dayKey}:${item.score}`) ?? null
      })(),
    }))

    const groupedEntries = new Map<string, QuickReadGroupBucket>()

    for (const entry of entries) {
      const key = entry.group ? `group-${entry.group.groupNumber}` : `option-${entry.item.option.id}`
      const existingGroup = groupedEntries.get(key)
      if (existingGroup) {
        existingGroup.entries.push(entry)
        continue
      }

      groupedEntries.set(key, {
        key,
        group: entry.group,
        entries: [entry],
      })
    }

    const groups = Array.from(groupedEntries.values()).map((groupedEntry) => ({
      ...groupedEntry,
      entries: [...groupedEntry.entries].sort(compareQuickReadEntriesByDate),
    }))

    return groups.sort((groupA, groupB) => {
      const bestRankA = groupA.entries.reduce((bestRank, entry) => Math.min(bestRank, entry.rank), Infinity)
      const bestRankB = groupB.entries.reduce((bestRank, entry) => Math.min(bestRank, entry.rank), Infinity)
      return bestRankA - bestRankB
    })
  }, [consecutiveGroupByDayScore, rankedOptions])
  const quickReadMaxGroupCount = allQuickReadGroups.length > 0 ? allQuickReadGroups.length : 1
  const quickReadGroupValue =
    allQuickReadGroups.length === 0
      ? 0
      : Math.min(quickReadGroupCount, quickReadMaxGroupCount)
  const displayedQuickReadGroups = useMemo(
    () => allQuickReadGroups.slice(0, quickReadGroupValue),
    [allQuickReadGroups, quickReadGroupValue]
  )
  const displayedQuickReadEntries = useMemo(
    () => displayedQuickReadGroups.flatMap((groupedOptions) => groupedOptions.entries),
    [displayedQuickReadGroups]
  )
  const groupedQuickReadKeys = useMemo(
    () => displayedQuickReadGroups.map((groupedOptions) => groupedOptions.key),
    [displayedQuickReadGroups]
  )
  const bindQuickReadGroupRef = useFlipListAnimation(groupedQuickReadKeys)
  const participantColSpan = sortedOptions.length + 1 + (canManageVotes ? 1 : 0)
  const participantColumnHeadClass = cn(
    "sticky left-0 z-20 border-r bg-background transition-[width,min-width,padding] duration-200 ease-out motion-reduce:transition-none",
    isParticipantColumnCollapsed
      ? "w-11 min-w-11 px-0 text-center"
      : "w-[9rem] min-w-[9rem] sm:w-[10.5rem] sm:min-w-[10.5rem] md:w-[14rem] md:min-w-[14rem]"
  )
  const participantColumnCellClass = cn(
    "sticky left-0 z-10 border-r bg-background transition-[width,min-width,padding] duration-200 ease-out motion-reduce:transition-none",
    isParticipantColumnCollapsed
      ? "w-11 min-w-11 px-0 text-center"
      : "w-[9rem] min-w-[9rem] whitespace-normal break-words sm:w-[10.5rem] sm:min-w-[10.5rem] md:w-[14rem] md:min-w-[14rem]"
  )
  const exportBaseName = useMemo(() => {
    const titlePart = sanitizeFileNamePart(pollState.title)
    const idPart = sanitizeFileNamePart(pollState.id).slice(0, 8)
    return `${titlePart}-${idPart}`
  }, [pollState.id, pollState.title])
  const overviewExportTable = useMemo<ExportTable>(
    () => ({
      title: `${pollState.title} - Results overview`,
      headers: ["Option", ...VOTE_STATUS_ORDER.map((status) => VOTE_STATUS_ARIA_LABEL[status])],
      rows: sortedOptions.map((option) => [
        formatPollOptionLabel(option.value),
        String(option.canCount),
        String(option.maybeCount),
        String(option.cantCount),
      ]),
    }),
    [pollState.title, sortedOptions]
  )
  const participantExportTable = useMemo<ExportTable>(
    () => ({
      title: `${pollState.title} - Who voted what`,
      headers: ["Participant", ...sortedOptions.map((option) => formatPollOptionLabel(option.value))],
      rows: filteredParticipants.map((participant) => [
        participant.fullName,
        ...sortedOptions.map((option) => {
          const vote = participant.votes[option.id]
          return vote ? VOTE_STATUS_LABEL[vote] : ""
        }),
      ]),
    }),
    [filteredParticipants, pollState.title, sortedOptions]
  )
  const insightsExportTable = useMemo<ExportTable>(
    () => ({
      title: `${pollState.title} - Insights`,
      headers: ["Rank", "Option", "Score", "Can", "Maybe", "Can't"],
      rows: displayedQuickReadEntries.map((entry) => [
        String(entry.rank),
        formatPollOptionLabel(entry.item.option.value),
        String(entry.item.score),
        String(entry.item.option.canCount),
        String(entry.item.option.maybeCount),
        String(entry.item.option.cantCount),
      ]),
    }),
    [displayedQuickReadEntries, pollState.title]
  )

  function notifyExport(message: string) {
    toast({
      variant: "success",
      title: "Export complete",
      description: message,
    })
  }

  function updateQuickReadGroupCount(nextCount: number) {
    if (allQuickReadGroups.length === 0) return

    const nextValue = Math.min(Math.max(nextCount, 1), quickReadMaxGroupCount)
    if (nextValue === quickReadGroupCount) return
    setQuickReadGroupCount(nextValue)
  }

  function handleQuickReadGroupCountInputChange(rawValue: string) {
    const parsedValue = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsedValue)) return
    updateQuickReadGroupCount(parsedValue)
  }

  function handleConnectedScoreToleranceChange(rawValue: string) {
    const parsedValue = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsedValue)) return

    const nextTolerance = Math.min(
      Math.max(Math.floor(parsedValue), 0),
      MAX_CONNECTED_INSIGHTS_SCORE_TOLERANCE
    )
    setConnectedScoreTolerance(nextTolerance)
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
          const message = payload.errors.join(". ")
          setRemoveVoteError(message)
          toast({
            variant: "error",
            title: "Could not remove votes",
            description: message,
          })
        } else if (payload && "error" in payload && payload.error) {
          setRemoveVoteError(payload.error)
          toast({
            variant: "error",
            title: "Could not remove votes",
            description: payload.error,
          })
        } else {
          setRemoveVoteError("Could not remove votes")
          toast({
            variant: "error",
            title: "Could not remove votes",
            description: "Please try again in a moment.",
          })
        }
        return
      }

      if (payload && "poll" in payload && payload.poll) {
        setPollState(payload.poll)
        setRemoveVoteState(null)
        toast({
          variant: "success",
          title: "Votes removed",
          description: "Participant votes were removed successfully.",
        })
      } else {
        setRemoveVoteError("Could not remove votes")
        toast({
          variant: "error",
          title: "Could not remove votes",
          description: "The server response was incomplete.",
        })
      }
    } catch {
      setRemoveVoteError("Could not remove votes")
      toast({
        variant: "error",
        title: "Could not remove votes",
        description: "Please try again in a moment.",
      })
    } finally {
      setIsRemovingVote(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="overflow-hidden app-enter-soft">
          <CardHeader className="border-b">
            <div className="space-y-1">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <CardTitle className="leading-snug">Results overview</CardTitle>
                <TableExportMenu
                  table={overviewExportTable}
                  fileBaseName={`${exportBaseName}-overview`}
                  triggerClassName="justify-self-end self-center"
                  onExport={notifyExport}
                />
              </div>
              <div className="pr-1">
                <CardDescription>Dates are shown in chronological order.</CardDescription>
              </div>
            </div>
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
                        <TableCell className="whitespace-normal">
                          {formatPollOptionLabelWithWeekday(option.value)}
                        </TableCell>
                        {VOTE_STATUS_ORDER.map((status) => (
                          <TableCell key={status} className="text-center font-medium">
                            <AnimatedCount value={countByStatus[status]} />
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Participants: <AnimatedCount value={pollState.participants.length} />
              </Badge>
              <Badge variant="outline">
                Options: <AnimatedCount value={sortedOptions.length} />
              </Badge>
              <Badge variant="outline">{canManageVotes ? "Organizer view" : "Participant view"}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden xl:sticky xl:top-4 xl:self-start app-enter-soft">
          <CardHeader className="border-b">
            <div className="space-y-1">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <CardTitle className="leading-snug">Insights</CardTitle>
                <TableExportMenu
                  table={insightsExportTable}
                  fileBaseName={`${exportBaseName}-insights`}
                  triggerClassName="justify-self-end self-center"
                  onExport={notifyExport}
                />
              </div>
              <div className="pr-1">
                <CardDescription>Quick read of the strongest groups.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-4">
            <div className="rounded-xl border bg-gradient-to-br from-background via-muted/25 to-background p-3">
              <div className="space-y-2">
                <section className="space-y-2 rounded-lg border bg-background/70 p-2">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Grouping
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={insightsGroupingMode === "strict" ? "default" : "outline"}
                      className="h-7 min-w-0 px-2 text-[11px]"
                      onClick={() => setInsightsGroupingMode("strict")}
                    >
                      Strict
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={insightsGroupingMode === "connected" ? "default" : "outline"}
                      className="h-7 min-w-0 px-2 text-[11px]"
                      onClick={() => setInsightsGroupingMode("connected")}
                    >
                      Connected
                    </Button>
                  </div>
                  {insightsGroupingMode === "connected" ? (
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="connected-score-tolerance"
                        className="text-muted-foreground min-w-0 text-[11px] font-medium"
                      >
                        Tolerance (+/-)
                      </label>
                      <Input
                        id="connected-score-tolerance"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_CONNECTED_INSIGHTS_SCORE_TOLERANCE}
                        step={1}
                        value={connectedScoreTolerance}
                        onChange={(event) => handleConnectedScoreToleranceChange(event.target.value)}
                        className="h-7 w-16 shrink-0 px-2 text-center text-[11px]"
                      />
                    </div>
                  ) : null}
                </section>

                <section className="space-y-2 rounded-lg border bg-background/70 p-2">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Quick read
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="quick-read-group-count"
                      className="text-muted-foreground min-w-0 text-[11px] font-medium"
                    >
                      Groups
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="quick-read-group-count"
                        type="number"
                        inputMode="numeric"
                        min={allQuickReadGroups.length === 0 ? 0 : 1}
                        max={quickReadMaxGroupCount}
                        step={1}
                        value={quickReadGroupValue}
                        disabled={allQuickReadGroups.length === 0}
                        onChange={(event) => handleQuickReadGroupCountInputChange(event.target.value)}
                        className="h-7 w-16 shrink-0 px-2 text-center text-[11px]"
                      />
                      <Badge variant="secondary" className="h-7 shrink-0 px-2 text-[11px] whitespace-nowrap">
                        {allQuickReadGroups.length === 0 ? (
                          "0/0"
                        ) : (
                          <>
                            <AnimatedCount value={quickReadGroupValue} />/
                            <AnimatedCount value={allQuickReadGroups.length} />
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {displayedQuickReadGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">No options available yet.</p>
            ) : (
              displayedQuickReadGroups.map((groupedOptions) => (
                <div
                  key={groupedOptions.key}
                  ref={bindQuickReadGroupRef(groupedOptions.key)}
                  className="space-y-1.5 motion-safe:will-change-transform"
                >
                  {groupedOptions.group ? (
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        Group <AnimatedCount value={groupedOptions.group.groupNumber} />
                      </Badge>
                      <Badge
                        variant={
                          highestScore !== null && groupedOptions.group.score === highestScore
                            ? "secondary"
                            : "outline"
                        }
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {groupedOptions.group.minScore === groupedOptions.group.maxScore ? (
                          <>
                            Score <AnimatedCount value={groupedOptions.group.score} />
                          </>
                        ) : (
                          <>
                            Scores <AnimatedCount value={groupedOptions.group.minScore} />-
                            <AnimatedCount value={groupedOptions.group.maxScore} />
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        Length <AnimatedCount value={groupedOptions.group.range.count} />{" "}
                        {groupedOptions.group.range.count === 1 ? "day" : "days"}
                      </Badge>
                      <span className="truncate">{formatConsecutiveRange(groupedOptions.group.range)}</span>
                    </div>
                  ) : null}
                  <div className="relative pl-3.5">
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute inset-y-1 left-1.5 w-px rounded ${
                        highestScore !== null && groupedOptions.group?.score === highestScore
                          ? "bg-emerald-500/60"
                          : "bg-muted-foreground/35"
                      }`}
                    />
                    <div className="space-y-1.5">
                      {groupedOptions.entries.map((entry) => (
                        <div
                          key={entry.item.option.id}
                          className="rounded-md border bg-background/80 px-2.5 py-2 app-enter-soft"
                        >
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                            <p className="truncate text-sm font-medium leading-tight">
                              {formatPollOptionLabel(entry.item.option.value)}
                            </p>
                            <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                              Score <AnimatedCount value={entry.item.score} />
                            </span>
                            <p className="text-muted-foreground text-[11px] font-medium">
                              Top <AnimatedCount value={entry.rank} />
                            </p>
                            <div className="text-muted-foreground flex flex-wrap items-center justify-end gap-2 text-[11px]">
                              {VOTE_STATUS_ORDER.map((status) => {
                                const countByStatus: Record<VoteStatus, number> = {
                                  can: entry.item.option.canCount,
                                  maybe: entry.item.option.maybeCount,
                                  cant: entry.item.option.cantCount,
                                }

                                return (
                                  <span key={status} className="inline-flex items-center gap-1">
                                    <VoteStatusIcon status={status} className="size-3.5" />
                                    <AnimatedCount value={countByStatus[status]} />
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden app-enter-soft">
        <CardHeader className="border-b">
          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <CardTitle className="leading-snug">Who voted what</CardTitle>
              <TableExportMenu
                table={participantExportTable}
                fileBaseName={`${exportBaseName}-vote-matrix`}
                triggerClassName="justify-self-end self-center"
                onExport={notifyExport}
              />
            </div>
            <div className="pr-1">
              <CardDescription>Detailed vote matrix for all participants and options.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6" suppressHydrationWarning>
          <TooltipProvider>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs" suppressHydrationWarning>
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={participantQuery}
                  onChange={(event) => setParticipantQuery(event.target.value)}
                  placeholder="Search participants"
                  aria-label="Search participants"
                  className="pl-9"
                  suppressHydrationWarning
                />
              </div>
              <p className="text-muted-foreground text-xs sm:ml-auto">
                {filteredParticipants.length} of {pollState.participants.length} participants
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table className="w-full min-w-[44rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className={participantColumnHeadClass}>
                      <div
                        className={cn(
                          "flex items-center",
                          isParticipantColumnCollapsed ? "justify-center" : "justify-between gap-2"
                        )}
                      >
                        {isParticipantColumnCollapsed ? (
                          <span className="sr-only">Participant</span>
                        ) : (
                          <span className="truncate">Participant</span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="h-7 w-7 shrink-0"
                              onClick={() => setIsParticipantColumnCollapsed((prev) => !prev)}
                              aria-label={
                                isParticipantColumnCollapsed
                                  ? "Expand participant names"
                                  : "Collapse participant names"
                              }
                              aria-pressed={isParticipantColumnCollapsed}
                              suppressHydrationWarning
                            >
                              {isParticipantColumnCollapsed ? (
                                <ChevronRight className="size-4" />
                              ) : (
                                <ChevronLeft className="size-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isParticipantColumnCollapsed ? "Expand participant names" : "Collapse participant names"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    {sortedOptions.map((option) => (
                      <TableHead key={option.id} className="whitespace-nowrap text-center">
                        {formatPollOptionLabelWithWeekday(option.value)}
                      </TableHead>
                    ))}
                    {canManageVotes ? <TableHead className="w-16 text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pollState.participants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={participantColSpan} className="text-muted-foreground">
                        No votes yet.
                      </TableCell>
                    </TableRow>
                  ) : filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={participantColSpan} className="text-muted-foreground">
                        No participants match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((participant) => (
                      <TableRow
                        key={participant.id}
                        ref={bindParticipantRowRef(participant.id)}
                        className="motion-safe:will-change-transform"
                      >
                        <TableCell className={participantColumnCellClass}>
                          {isParticipantColumnCollapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold">
                                  {getParticipantInitial(participant.fullName)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{participant.fullName}</TooltipContent>
                            </Tooltip>
                          ) : (
                            participant.fullName
                          )}
                        </TableCell>
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
          {removeVoteError ? <p className="text-sm text-destructive app-enter-scale">{removeVoteError}</p> : null}
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
