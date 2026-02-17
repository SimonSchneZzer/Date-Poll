"use client"

import { Loader2, LogOut, Save, Settings, Trash2, UserRound } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { AuthUser } from "@/lib/auth/supabase-auth"
import { clearTrackedPolls } from "@/lib/date-poll/tracked-polls"

type ProfileSettingsFormProps = {
  initialUser: AuthUser
}

type ProfileResponse = {
  user?: AuthUser
  error?: string
  message?: string
  passwordUpdated?: boolean
}

type DeleteResponse = {
  ok?: boolean
  error?: string
}

export function ProfileSettingsForm({ initialUser }: ProfileSettingsFormProps) {
  const [fullName, setFullName] = useState(initialUser.fullName ?? "")
  const [email, setEmail] = useState(initialUser.email ?? "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)
    setProfileMessage(null)
    setIsSavingProfile(true)

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
        }),
      })

      const payload = (await response.json().catch(() => null)) as ProfileResponse | null
      if (!response.ok) {
        setProfileError(payload?.error ?? "Could not save profile")
        return
      }

      if (payload?.user) {
        setFullName(payload.user.fullName ?? "")
        setEmail(payload.user.email ?? "")
      }

      setProfileMessage(payload?.message ?? "Profile updated")
    } catch {
      setProfileError("Could not save profile")
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setIsSavingPassword(true)

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: newPassword }),
      })

      const payload = (await response.json().catch(() => null)) as ProfileResponse | null
      if (!response.ok) {
        setPasswordError(payload?.error ?? "Could not update password")
        return
      }

      setNewPassword("")
      setConfirmPassword("")
      setPasswordMessage("Password updated")
    } catch {
      setPasswordError("Could not update password")
    } finally {
      setIsSavingPassword(false)
    }
  }

  async function logout() {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      clearTrackedPolls()
    } finally {
      window.location.href = "/login"
    }
  }

  async function deleteAccount() {
    if (isDeletingAccount) return

    setDeleteError(null)
    if (deleteConfirmInput !== "DELETE") {
      setDeleteError("Type DELETE to confirm")
      return
    }

    setIsDeletingAccount(true)

    try {
      const response = await fetch("/api/auth/profile", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      })

      const payload = (await response.json().catch(() => null)) as DeleteResponse | null
      if (!response.ok) {
        setDeleteError(payload?.error ?? "Could not delete account")
        return
      }

      clearTrackedPolls()
      window.location.href = "/register"
    } catch {
      setDeleteError("Could not delete account")
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/20 to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-12 size-44 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-52 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
              Account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
            <p className="text-muted-foreground max-w-xl text-sm">
              Manage your account information and security preferences.
            </p>
          </div>
          <div className="bg-background/80 text-muted-foreground flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm backdrop-blur">
            <Settings className="size-4 shrink-0" />
            <span className="truncate">{initialUser.email ?? "Signed in account"}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="text-muted-foreground size-4" />
              Personal details
            </CardTitle>
            <CardDescription>Update your name and email address.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={saveProfile}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fullName">
                  Full name
                </label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
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
              {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
              {profileMessage ? <p className="text-sm text-emerald-600">{profileMessage}</p> : null}
              <Button type="submit" className="w-full sm:w-auto" disabled={isSavingProfile}>
                {isSavingProfile ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="border-b">
            <CardTitle>Security</CardTitle>
            <CardDescription>Set a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form className="space-y-4" onSubmit={savePassword}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="newPassword">
                  New password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirmPassword">
                  Confirm new password
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
              {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
              {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}
              <Button type="submit" className="w-full sm:w-auto" disabled={isSavingPassword}>
                {isSavingPassword ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive/40 lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>Log out or permanently delete your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={logout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="size-4" />
                    Log out
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete account
              </Button>
            </div>

            {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeletingAccount) {
            setIsDeleteDialogOpen(open)
            if (!open) {
              setDeleteConfirmInput("")
              setDeleteError(null)
            }
          }
        }}
      >
        <DialogContent showCloseButton={!isDeletingAccount}>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This removes your account and related poll participation/ownership. Type DELETE to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="deleteConfirm">
              Confirmation
            </label>
            <Input
              id="deleteConfirm"
              value={deleteConfirmInput}
              onChange={(event) => setDeleteConfirmInput(event.target.value)}
              placeholder="Type DELETE"
              disabled={isDeletingAccount}
            />
          </div>

          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingAccount}
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={isDeletingAccount} onClick={deleteAccount}>
              {isDeletingAccount ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
