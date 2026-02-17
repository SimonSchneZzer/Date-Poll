"use client"

import { cn } from "@/lib/utils"

type AnimatedCountProps = {
  value: number | string
  className?: string
}

export function AnimatedCount({ value, className }: AnimatedCountProps) {
  return (
    <span className="inline-flex tabular-nums">
      <span key={String(value)} className={cn("inline-flex app-value-pop", className)}>
        {value}
      </span>
    </span>
  )
}
