"use client"

import * as React from "react"

import { useTypedPlaceholder } from "@/lib/use-typed-placeholder"
import { cn } from "@/lib/utils"

function Textarea({
  className,
  onFocus,
  onBlur,
  placeholder,
  ...props
}: React.ComponentProps<"textarea">) {
  const { displayedPlaceholder, startTyping, stopTyping } = useTypedPlaceholder(placeholder)

  return (
    <textarea
      data-slot="textarea"
      placeholder={displayedPlaceholder}
      onFocus={(event) => {
        startTyping()
        onFocus?.(event)
      }}
      onBlur={(event) => {
        stopTyping()
        onBlur?.(event)
      }}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive field-sizing-content min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
