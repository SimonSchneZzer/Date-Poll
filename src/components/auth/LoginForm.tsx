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
  configured: boolean
  initialError?: string | null
}

export function LoginForm({ nextPath, configured, initialError }: LoginFormProps) {
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
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Sign in to create polls. Voting on existing polls still works without login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={handlePasswordSignIn}>
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
          <p className="text-muted-foreground text-xs">
            Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            to enable auth.
          </p>
        ) : null}

        <p className="text-muted-foreground text-xs">
          You will be redirected back to <code>{nextPath}</code> after sign-in.
        </p>

        <div className="flex items-center justify-between text-sm">
          <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="underline">
            Need an account? Register
          </Link>
          <Link href="/" className="underline">
            Back to home
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
