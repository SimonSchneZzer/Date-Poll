import { NextResponse } from "next/server"

import {
  extractSessionFromSignUp,
  isSupabaseConfigured,
  mapSignUpUser,
  setAuthCookies,
  signUpWithPassword,
} from "@/lib/auth/supabase-auth"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 }
    )
  }

  const payload = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; fullName?: string }
    | null

  const email = payload?.email?.trim() ?? ""
  const password = payload?.password ?? ""
  const fullName = payload?.fullName?.trim() ?? ""

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  const result = await signUpWithPassword({
    email,
    password,
    fullName: fullName || undefined,
  })

  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const session = extractSessionFromSignUp(result.data)
  const user = mapSignUpUser(result.data)

  const response = NextResponse.json({
    user,
    requiresEmailConfirmation: !session,
  })

  if (session) {
    setAuthCookies(response, session)
  }

  return response
}
