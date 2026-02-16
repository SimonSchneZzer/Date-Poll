"use client"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
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

export function DateRangePicker({
  value,
  onChange,
  fromDate,
  toDate,
  defaultMonth,
  numberOfMonths = 2,
  placeholder = "Pick a date range",
}: DateRangePickerProps) {
  const disabledOutsideRange =
    fromDate || toDate
      ? [
          ...(fromDate ? [{ before: fromDate }] : []),
          ...(toDate ? [{ after: toDate }] : []),
        ]
      : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.from && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "PPP")} - {format(value.to, "PPP")}
              </>
            ) : (
              format(value.from, "PPP")
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          defaultMonth={defaultMonth ?? fromDate}
          numberOfMonths={numberOfMonths}
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
