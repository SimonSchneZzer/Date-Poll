import { NextRequest, NextResponse } from "next/server"

import {
  clearAuthCookies,
  deleteAuthUserById,
  getAccessTokenFromCookies,
  getCurrentUserFromCookies,
  getRefreshTokenFromCookies,
  isSupabaseConfigured,
  refreshSessionWithToken,
  setAuthCookies,
  updateCurrentUserProfile,
} from "@/lib/auth/supabase-auth"
import { leaveAllPollsForUser } from "@/lib/date-poll/store"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 }
    )
  }

  const currentUser = await getCurrentUserFromCookies(request.cookies)
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as
    | { fullName?: string; email?: string; password?: string }
    | null

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const hasFullName = Object.hasOwn(payload, "fullName")
  const hasEmail = Object.hasOwn(payload, "email")
  const hasPassword = Object.hasOwn(payload, "password")

  if (!hasFullName && !hasEmail && !hasPassword) {
    return NextResponse.json({ error: "No profile changes provided" }, { status: 400 })
  }

  const fullNameInput = hasFullName ? (payload.fullName ?? "").trim() : undefined
  const emailInput = hasEmail ? (payload.email ?? "").trim() : undefined
  const passwordInput = hasPassword ? (payload.password ?? "") : undefined

  if (emailInput !== undefined && !emailInput) {
    return NextResponse.json({ error: "Email cannot be empty" }, { status: 400 })
  }

  if (emailInput && !EMAIL_RE.test(emailInput)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
  }

  if (passwordInput !== undefined && passwordInput.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  let accessToken = getAccessTokenFromCookies(request.cookies)
  const refreshToken = getRefreshTokenFromCookies(request.cookies)
  let refreshedSession: Awaited<ReturnType<typeof refreshSessionWithToken>>["data"] | null = null

  if (!accessToken) {
    if (!refreshToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const refreshResult = await refreshSessionWithToken(refreshToken)
    if (!refreshResult.data) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    refreshedSession = refreshResult.data
    accessToken = refreshResult.data.access_token
  }

  let updateResult = await updateCurrentUserProfile({
    accessToken,
    ...(emailInput !== undefined ? { email: emailInput } : {}),
    ...(passwordInput !== undefined ? { password: passwordInput } : {}),
    ...(fullNameInput !== undefined ? { fullName: fullNameInput || null } : {}),
  })

  if (!updateResult.data && refreshToken && !refreshedSession) {
    const refreshResult = await refreshSessionWithToken(refreshToken)
    if (refreshResult.data) {
      refreshedSession = refreshResult.data
      updateResult = await updateCurrentUserProfile({
        accessToken: refreshResult.data.access_token,
        ...(emailInput !== undefined ? { email: emailInput } : {}),
        ...(passwordInput !== undefined ? { password: passwordInput } : {}),
        ...(fullNameInput !== undefined ? { fullName: fullNameInput || null } : {}),
      })
    }
  }

  if (!updateResult.data) {
    return NextResponse.json({ error: updateResult.error }, { status: 400 })
  }

  const response = NextResponse.json({
    user: updateResult.data,
    ...(emailInput ? { message: "If email confirmation is enabled, confirm your new email address." } : {}),
    ...(passwordInput ? { passwordUpdated: true } : {}),
  })

  if (refreshedSession) {
    setAuthCookies(response, refreshedSession)
  }

  return response
}

export async function DELETE(request: NextRequest) {
  const currentUser = await getCurrentUserFromCookies(request.cookies)
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as
    | { confirm?: string }
    | null

  if (payload?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Confirmation text must be DELETE" }, { status: 400 })
  }

  try {
    await leaveAllPollsForUser(currentUser.id)
  } catch {
    return NextResponse.json({ error: "Could not delete account data" }, { status: 500 })
  }

  const deleteResult = await deleteAuthUserById(currentUser.id)
  if (deleteResult.error) {
    const status = deleteResult.error.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500
    return NextResponse.json({ error: deleteResult.error }, { status })
  }

  const response = NextResponse.json({ ok: true })
  clearAuthCookies(response)
  return response
}
