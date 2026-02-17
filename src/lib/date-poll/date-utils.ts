const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
})

function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_RE.test(value)) return null

  const [rawYear, rawMonth, rawDay] = value.split("-")
  const year = Number.parseInt(rawYear, 10)
  const month = Number.parseInt(rawMonth, 10)
  const day = Number.parseInt(rawDay, 10)

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null
  }

  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

export function isDateOnlyPollOption(value: string): boolean {
  return DATE_ONLY_RE.test(value)
}

export function parsePollOptionDate(value: string): Date | null {
  const dateOnly = parseDateOnly(value)
  if (dateOnly) return dateOnly

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function getPollOptionTimestamp(value: string): number {
  const parsed = parsePollOptionDate(value)
  return parsed ? parsed.getTime() : Number.NaN
}

export function getPollOptionLocalDay(value: string): Date | null {
  const parsed = parsePollOptionDate(value)
  if (!parsed) return null

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function formatPollOptionLabel(value: string): string {
  const parsed = parsePollOptionDate(value)
  if (!parsed) return value

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: isDateOnlyPollOption(value) ? undefined : "short",
  })

  return formatter.format(parsed)
}

export function formatPollOptionLabelWithWeekday(value: string): string {
  const parsed = parsePollOptionDate(value)
  if (!parsed) return value

  return `${WEEKDAY_FORMATTER.format(parsed)}, ${formatPollOptionLabel(value)}`
}
