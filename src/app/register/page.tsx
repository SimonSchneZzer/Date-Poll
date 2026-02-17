import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ShieldCheck, UserPlus } from "lucide-react"

import { RegisterForm } from "@/components/auth/RegisterForm"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  describeNextPath,
  getCurrentUserFromCookies,
  isSupabaseConfigured,
  normalizeNextPath,
} from "@/lib/auth/supabase-auth"

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

function mapRegisterError(error: string | undefined): string | null {
  if (!error) return null
  try {
    return decodeURIComponent(error).replace(/_/g, " ")
  } catch {
    return error.replace(/_/g, " ")
  }
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  const nextPath = normalizeNextPath(params.next)
  const nextPathLabel = describeNextPath(nextPath)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (user) {
    redirect(nextPath)
  }

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
                Account
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Create account</h1>
              <p className="text-muted-foreground max-w-xl text-sm">
                Set up your account to create, organize, and manage polls across devices.
              </p>
            </div>
            <div className="bg-background/80 text-muted-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
              <UserPlus className="size-4 shrink-0" />
              <span className="truncate">Continue to {nextPathLabel}</span>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Email + password</Badge>
            <Badge variant="secondary">Account settings included</Badge>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <RegisterForm
            nextPath={nextPath}
            nextPathLabel={nextPathLabel}
            configured={isSupabaseConfigured()}
            initialError={mapRegisterError(params.error)}
          />
          <Card className="h-fit overflow-hidden lg:sticky lg:top-24">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="text-muted-foreground size-4" />
                Before you start
              </CardTitle>
              <CardDescription>What happens after registration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pt-6 text-sm">
              <p className="text-muted-foreground">Use your account to create and administer polls.</p>
              <p className="text-muted-foreground">If required, confirm your email and then sign in.</p>
              <p className="text-muted-foreground">
                After registration, you will continue to {nextPathLabel}.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
