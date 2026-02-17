"use client"

import { CalendarIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type DateRangePickerProps = {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  fromDate?: Date
  toDate?: Date
  defaultMonth?: Date
  numberOfMonths?: number
  placeholder?: string
}

function formatLocalizedDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

function getRangeLabel(args: {
  value: DateRange | undefined
  placeholder: string
  compact: boolean
}): string {
  const { value, placeholder, compact } = args

  if (!value?.from) {
    return compact ? "Select range or day" : placeholder
  }

  if (!value.to) {
    return compact
      ? formatLocalizedDate(value.from, { day: "numeric", month: "short", year: "numeric" })
      : formatLocalizedDate(value.from, { dateStyle: "medium" })
  }

  if (!compact) {
    return `${formatLocalizedDate(value.from, { dateStyle: "medium" })} - ${formatLocalizedDate(value.to, { dateStyle: "medium" })}`
  }

  const sameYear = value.from.getFullYear() === value.to.getFullYear()
  if (sameYear) {
    return `${formatLocalizedDate(value.from, { day: "numeric", month: "short" })} - ${formatLocalizedDate(value.to, { day: "numeric", month: "short", year: "numeric" })}`
  }

  return `${formatLocalizedDate(value.from, { day: "numeric", month: "short", year: "numeric" })} - ${formatLocalizedDate(value.to, { day: "numeric", month: "short", year: "numeric" })}`
}

export function DateRangePicker({
  value,
  onChange,
  fromDate,
  toDate,
  defaultMonth,
  numberOfMonths = 2,
  placeholder = "Pick a date range",
}: DateRangePickerProps) {
  const [isSmallViewport, setIsSmallViewport] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const updateViewportSize = () => setIsSmallViewport(mediaQuery.matches)

    updateViewportSize()
    mediaQuery.addEventListener("change", updateViewportSize)

    return () => mediaQuery.removeEventListener("change", updateViewportSize)
  }, [])

  const disabledOutsideRange =
    fromDate || toDate
      ? [
          ...(fromDate ? [{ before: fromDate }] : []),
          ...(toDate ? [{ after: toDate }] : []),
        ]
      : undefined

  const visibleMonths = isSmallViewport ? 1 : numberOfMonths
  const fullLabel = getRangeLabel({
    value,
    placeholder,
    compact: false,
  })
  const displayLabel = getRangeLabel({
    value,
    placeholder,
    compact: isSmallViewport,
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full min-w-0 justify-start overflow-hidden text-left font-normal",
            !value?.from && "text-muted-foreground"
          )}
          title={fullLabel}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="min-w-0 truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={isSmallViewport ? "center" : "start"}
        collisionPadding={8}
        className="w-auto max-h-[calc(100svh-2rem)] max-w-[calc(100vw-1rem)] overflow-auto p-0"
      >
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          defaultMonth={defaultMonth ?? fromDate}
          numberOfMonths={visibleMonths}
          fromDate={fromDate}
          toDate={toDate}
          fromMonth={fromDate}
          toMonth={toDate}
          disabled={disabledOutsideRange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
