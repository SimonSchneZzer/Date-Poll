"use client"

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

type ToastInput = {
  title?: string
  description: string
  variant?: ToastVariant
  durationMs?: number
}

type ToastRecord = ToastInput & {
  id: number
  variant: ToastVariant
}

type ToastContextValue = {
  toast: (input: ToastInput) => void
}

const DEFAULT_DURATION_MS = 3600

const ToastContext = createContext<ToastContextValue | null>(null)

function getToastIcon(variant: ToastVariant) {
  if (variant === "success") return <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
  if (variant === "error") return <AlertTriangle className="size-4 text-destructive" aria-hidden />
  return <Info className="size-4 text-primary" aria-hidden />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timeoutByToastIdRef = useRef(new Map<number, number>())

  const removeToast = useCallback((toastId: number) => {
    const timeoutId = timeoutByToastIdRef.current.get(toastId)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutByToastIdRef.current.delete(toastId)
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const toastId = Date.now() + Math.floor(Math.random() * 1000)
      const nextToast: ToastRecord = {
        ...input,
        id: toastId,
        variant: input.variant ?? "info",
      }
      const durationMs = input.durationMs ?? DEFAULT_DURATION_MS

      setToasts((current) => [...current, nextToast])
      const timeoutId = window.setTimeout(() => {
        removeToast(toastId)
      }, durationMs)
      timeoutByToastIdRef.current.set(toastId, timeoutId)
    },
    [removeToast]
  )

  useEffect(() => {
    const timeoutMap = timeoutByToastIdRef.current

    return () => {
      for (const timeoutId of timeoutMap.values()) {
        window.clearTimeout(timeoutId)
      }
      timeoutMap.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[110] flex w-[min(92vw,24rem)] flex-col gap-2 sm:right-6 sm:bottom-6">
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={cn(
              "bg-card/95 text-card-foreground pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-lg backdrop-blur-sm app-enter-scale",
              item.variant === "error" && "border-destructive/40"
            )}
          >
            <div className="mt-0.5 shrink-0">{getToastIcon(item.variant)}</div>
            <div className="min-w-0 flex-1">
              {item.title ? <p className="truncate text-sm font-medium">{item.title}</p> : null}
              <p className="text-muted-foreground text-xs">{item.description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Dismiss notification"
              onClick={() => removeToast(item.id)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
