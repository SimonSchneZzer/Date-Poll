import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8 app-enter-soft">
          <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-64 max-w-[90%]" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-5 app-enter-soft">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-52" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-[11rem]" />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border p-5 app-enter-soft">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
