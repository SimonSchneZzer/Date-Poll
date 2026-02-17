"use client"

import { Loader2, LogIn } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type LoginFormProps = {
  nextPath: string
  nextPathLabel: string
  configured: boolean
  initialError?: string | null
}

export function LoginForm({ nextPath, nextPathLabel, configured, initialError }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [isLoading, setIsLoading] = useState(false)

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!configured) {
      setError("Supabase is not configured yet")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        setError(payload?.error ?? "Sign in failed")
        return
      }

      router.push(nextPath)
      router.refresh()
    } catch {
      setError("Sign in failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="text-xl sm:text-2xl">Sign in</CardTitle>
        <CardDescription>
          Sign in to create polls. Voting on existing polls still works without login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <form className="space-y-4" onSubmit={handlePasswordSignIn}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                Sign in with password
              </>
            )}
          </Button>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!configured ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="text-muted-foreground">
              Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              to enable auth.
            </p>
          </div>
        ) : null}

        <div className="text-muted-foreground rounded-md border bg-muted/20 p-3 text-xs">
          You will be redirected back to {nextPathLabel} after sign-in.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
          <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="hover:text-foreground underline">
            Need an account? Register
          </Link>
          <Link href="/" className="hover:text-foreground underline">
            Back to home
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
