import { NextResponse } from "next/server"

import {
  isSupabaseConfigured,
  mapSessionUser,
  setAuthCookies,
  signInWithPassword,
} from "@/lib/auth/supabase-auth"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      { status: 503 }
    )
  }

  const payload = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  const email = payload?.email?.trim() ?? ""
  const password = payload?.password ?? ""

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const result = await signInWithPassword({ email, password })

  if (!result.data) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json({ user: mapSessionUser(result.data) })
  setAuthCookies(response, result.data)

  return response
}
