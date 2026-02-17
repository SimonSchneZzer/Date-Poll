"use client"

import { useCallback, useLayoutEffect, useMemo, useRef } from "react"

const FLIP_ANIMATION_OPTIONS: KeyframeAnimationOptions = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
}

const ENTER_ANIMATION_OPTIONS: KeyframeAnimationOptions = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
}

export function useFlipListAnimation(itemIds: readonly string[]) {
  const nodeByIdRef = useRef(new Map<string, HTMLElement>())
  const previousRectByIdRef = useRef(new Map<string, DOMRect>())
  const idsKey = useMemo(() => itemIds.join("::"), [itemIds])

  const bindItemRef = useCallback(
    (itemId: string) => (node: HTMLElement | null) => {
      if (node) {
        nodeByIdRef.current.set(itemId, node)
      } else {
        nodeByIdRef.current.delete(itemId)
      }
    },
    []
  )

  useLayoutEffect(() => {
    const nextRectById = new Map<string, DOMRect>()

    for (const itemId of itemIds) {
      const node = nodeByIdRef.current.get(itemId)
      if (!node) continue

      const nextRect = node.getBoundingClientRect()
      nextRectById.set(itemId, nextRect)
      const previousRect = previousRectByIdRef.current.get(itemId)

      if (typeof node.animate !== "function") continue

      if (!previousRect) {
        node.animate(
          [
            { opacity: 0, transform: "translateY(6px) scale(0.995)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          ENTER_ANIMATION_OPTIONS
        )
        continue
      }

      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        FLIP_ANIMATION_OPTIONS
      )
    }

    previousRectByIdRef.current = nextRectById
  }, [idsKey, itemIds])

  return bindItemRef
}
