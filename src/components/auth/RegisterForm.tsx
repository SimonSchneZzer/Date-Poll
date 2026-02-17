"use client"

import { Loader2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type RegisterFormProps = {
  nextPath: string
  nextPathLabel: string
  configured: boolean
  initialError?: string | null
}

export function RegisterForm({ nextPath, nextPathLabel, configured, initialError }: RegisterFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!configured) {
      setError("Supabase is not configured yet")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          password,
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; requiresEmailConfirmation?: boolean }
        | null

      if (!response.ok) {
        setError(payload?.error ?? "Sign up failed")
        return
      }

      if (payload?.requiresEmailConfirmation) {
        setSuccess("Account created. Check your email to confirm your account, then sign in.")
        return
      }

      router.push(nextPath)
      router.refresh()
    } catch {
      setError("Sign up failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="text-xl sm:text-2xl">Create account</CardTitle>
        <CardDescription>
          Create an account to create and manage polls.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="fullName">
              Full name (optional)
            </label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Doe"
            />
          </div>
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
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirmPassword">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="size-4" />
                Create account
              </>
            )}
          </Button>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            {success}
          </p>
        ) : null}

        {!configured ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="text-muted-foreground">
              Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              to enable auth.
            </p>
          </div>
        ) : null}

        <div className="text-muted-foreground rounded-md border bg-muted/20 p-3 text-xs">
          After sign-up, you will continue to {nextPathLabel}.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="hover:text-foreground underline">
            Already have an account? Sign in
          </Link>
          <Link href="/" className="hover:text-foreground underline">
            Back to home
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
