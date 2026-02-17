"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const MIN_TYPE_DELAY_MS = 34
const TYPE_DELAY_JITTER_MS = 88
const MIN_DELETE_DELAY_MS = 24
const DELETE_DELAY_JITTER_MS = 70
const EXTRA_PAUSE_CHANCE = 0.18
const MIN_EXTRA_PAUSE_MS = 70
const EXTRA_PAUSE_JITTER_MS = 170
const MIN_INITIAL_DELAY_MS = 20
const INITIAL_DELAY_JITTER_MS = 75
const MIN_TYPED_HOLD_MS = 760
const TYPED_HOLD_JITTER_MS = 980
const MIN_CYCLE_GAP_MS = 140
const CYCLE_GAP_JITTER_MS = 260

const EXAMPLE_TEXTS_BY_PLACEHOLDER: Record<string, string[]> = {
  "date poll": ["Holiday planning", "Team offsite dates", "Birthday weekend"],
  "any trip context for participants": [
    "Holiday planning with friends",
    "Family trip in July",
    "Remote team meetup",
  ],
  "you@example.com": [
    "alex.taylor@example.com",
    "jamie.lee@example.com",
    "travel.team@example.com",
  ],
  "your password": [
    "Use 12+ characters",
    "Add symbols and numbers",
    "Avoid reused passwords",
  ],
  "at least 6 characters": [
    "Use 12+ characters",
    "Try a phrase with symbols",
    "Mix letters and numbers",
  ],
  "repeat password": [
    "Type the same password",
    "Match the password above",
    "Confirm your password",
  ],
  "your name": ["Simon Schnetzer", "Alex Taylor", "Jamie Rivera"],
  "jane doe": ["Maya Thompson", "Noah Bennett", "Liam Carter"],
  "type delete": ["DELETE", "confirm deletion", "permanent action"],
  "search participants": ["Anna", "Chris Kim", "Noah"],
  "paste poll link or enter poll id": [
    "/poll/summer-trip-2026",
    "https://datepoll.app/poll/wknd42",
    "wknd-plan-42",
  ],
}

function getKeyStrokeDelay() {
  const keyStrokeDelay = MIN_TYPE_DELAY_MS + Math.floor(Math.random() * TYPE_DELAY_JITTER_MS)
  const extraPause =
    Math.random() < EXTRA_PAUSE_CHANCE
      ? MIN_EXTRA_PAUSE_MS + Math.floor(Math.random() * EXTRA_PAUSE_JITTER_MS)
      : 0

  return keyStrokeDelay + extraPause
}

function getInitialDelay() {
  return MIN_INITIAL_DELAY_MS + Math.floor(Math.random() * INITIAL_DELAY_JITTER_MS)
}

function getDeleteDelay() {
  const keyStrokeDelay = MIN_DELETE_DELAY_MS + Math.floor(Math.random() * DELETE_DELAY_JITTER_MS)
  const extraPause =
    Math.random() < EXTRA_PAUSE_CHANCE * 0.7
      ? Math.floor(MIN_EXTRA_PAUSE_MS * 0.5) + Math.floor(Math.random() * Math.floor(EXTRA_PAUSE_JITTER_MS * 0.5))
      : 0

  return keyStrokeDelay + extraPause
}

function getTypedHoldDelay() {
  return MIN_TYPED_HOLD_MS + Math.floor(Math.random() * TYPED_HOLD_JITTER_MS)
}

function getCycleGapDelay() {
  return MIN_CYCLE_GAP_MS + Math.floor(Math.random() * CYCLE_GAP_JITTER_MS)
}

function getExampleTexts(placeholder: string): string[] {
  const normalizedPlaceholder = placeholder.trim().toLowerCase()
  const mappedExamples = EXAMPLE_TEXTS_BY_PLACEHOLDER[normalizedPlaceholder] ?? [
    "Holiday planning",
    "Team meetup dates",
    "Weekend trip options",
  ]

  const unique = new Set<string>()
  for (const example of mappedExamples) {
    const trimmed = example.trim()
    if (!trimmed) continue
    if (trimmed.toLowerCase() === normalizedPlaceholder) continue
    unique.add(trimmed)
  }

  return [...unique]
}

export function useTypedPlaceholder(placeholder: string | undefined) {
  const basePlaceholder = placeholder ?? ""
  const exampleTexts = useMemo(() => getExampleTexts(basePlaceholder), [basePlaceholder])
  const timeoutRef = useRef<number | null>(null)
  const modeRef = useRef<"typing" | "deleting">("typing")
  const charIndexRef = useRef(0)
  const exampleIndexRef = useRef(0)
  const isAnimatingRef = useRef(false)
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState<string | null>(null)
  const displayedPlaceholder = animatedPlaceholder ?? basePlaceholder

  const clearTypingTimeout = useCallback(() => {
    if (timeoutRef.current === null) return
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearTypingTimeout()
    }
  }, [clearTypingTimeout])

  const startTyping = useCallback(() => {
    if (exampleTexts.length === 0) return
    if (isAnimatingRef.current) return

    clearTypingTimeout()
    isAnimatingRef.current = true
    modeRef.current = "typing"
    charIndexRef.current = 0
    setAnimatedPlaceholder("")

    const runAnimationStep = () => {
      if (!isAnimatingRef.current) return
      if (exampleTexts.length === 0) return

      const currentExample = exampleTexts[exampleIndexRef.current % exampleTexts.length]
      if (!currentExample) {
        isAnimatingRef.current = false
        setAnimatedPlaceholder(null)
        return
      }

      if (modeRef.current === "typing") {
        charIndexRef.current += 1
        setAnimatedPlaceholder(currentExample.slice(0, charIndexRef.current))

        if (charIndexRef.current >= currentExample.length) {
          modeRef.current = "deleting"
          timeoutRef.current = window.setTimeout(runAnimationStep, getTypedHoldDelay())
          return
        }

        timeoutRef.current = window.setTimeout(runAnimationStep, getKeyStrokeDelay())
        return
      }

      charIndexRef.current = Math.max(0, charIndexRef.current - 1)
      setAnimatedPlaceholder(currentExample.slice(0, charIndexRef.current))

      if (charIndexRef.current === 0) {
        modeRef.current = "typing"
        exampleIndexRef.current = (exampleIndexRef.current + 1) % exampleTexts.length
        timeoutRef.current = window.setTimeout(runAnimationStep, getCycleGapDelay())
        return
      }

      timeoutRef.current = window.setTimeout(runAnimationStep, getDeleteDelay())
    }

    timeoutRef.current = window.setTimeout(runAnimationStep, getInitialDelay())
  }, [clearTypingTimeout, exampleTexts])

  const stopTyping = useCallback(() => {
    clearTypingTimeout()
    isAnimatingRef.current = false
    modeRef.current = "typing"
    charIndexRef.current = 0
    setAnimatedPlaceholder(null)
  }, [clearTypingTimeout])

  return {
    displayedPlaceholder,
    startTyping,
    stopTyping,
  }
}
