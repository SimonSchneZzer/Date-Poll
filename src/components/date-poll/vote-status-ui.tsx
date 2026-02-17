import { CircleCheck, CircleEllipsis, CircleX, type LucideIcon } from "lucide-react"

import type { VoteStatus } from "@/lib/date-poll/types"

export const VOTE_STATUS_ORDER = ["can", "maybe", "cant"] as const

export const VOTE_STATUS_LABEL: Record<VoteStatus, string> = {
  can: "can",
  maybe: "maybe",
  cant: "can't",
}

export const VOTE_STATUS_ARIA_LABEL: Record<VoteStatus, string> = {
  can: "Can",
  maybe: "Maybe",
  cant: "Can't",
}

export const VOTE_STATUS_ICON: Record<VoteStatus, LucideIcon> = {
  can: CircleCheck,
  maybe: CircleEllipsis,
  cant: CircleX,
}

export const VOTE_STATUS_ICON_COLOR: Record<VoteStatus, string> = {
  can: "text-emerald-600",
  maybe: "text-amber-500",
  cant: "text-destructive",
}

export function VoteStatusIcon({
  status,
  className,
}: {
  status: VoteStatus
  className?: string
}) {
  const Icon = VOTE_STATUS_ICON[status]
  const classes = [className, VOTE_STATUS_ICON_COLOR[status]].filter(Boolean).join(" ")

  return <Icon className={classes} aria-hidden />
}
