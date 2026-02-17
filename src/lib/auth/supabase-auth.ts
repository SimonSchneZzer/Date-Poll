import type { NextResponse } from "next/server"

export type AuthUser = {
  id: string
  email: string | null
  fullName: string | null
}

type SupabaseUser = {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string | null
    name?: string | null
    [key: string]: unknown
  } | null
}

type SupabaseAuthSession = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: SupabaseUser
}

type SupabaseSignUpPayload = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user?: SupabaseUser | null
  session?: {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    user?: SupabaseUser | null
  } | null
}

type AuthApiResponse<T> =
  | {
      data: T
      error: null
    }
  | {
      data: null
      error: string
    }

type CookieReader = {
  get: (name: string) => { value: string } | undefined
}

const ACCESS_TOKEN_COOKIE = "tp_access_token"
const REFRESH_TOKEN_COOKIE = "tp_refresh_token"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseConfig())
}

function mapUser(user: SupabaseUser): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
  }
}

function parseUserPayload(payload: unknown): SupabaseUser | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const candidate = payload as { user?: unknown; id?: unknown }
  if (candidate.user && typeof candidate.user === "object") {
    const nested = candidate.user as Partial<SupabaseUser>
    if (typeof nested.id === "string") {
      return nested as SupabaseUser
    }
  }

  if (typeof candidate.id === "string") {
    return payload as SupabaseUser
  }

  return null
}

function parseSupabaseError(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Authentication failed"
  }

  const candidate = payload as {
    msg?: string
    error_description?: string
    error?: string
    message?: string
  }

  return (
    candidate.error_description ??
    candidate.msg ??
    candidate.message ??
    candidate.error ??
    "Authentication failed"
  )
}

function isSafeRedirectPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"))
}

export function normalizeNextPath(path: string | null | undefined): string {
  return isSafeRedirectPath(path) ? path : "/"
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function describeNextPath(path: string | null | undefined): string {
  const safePath = normalizeNextPath(path)

  if (safePath === "/") return "Home"
  if (safePath === "/dashboard") return "Dashboard"
  if (safePath === "/poll/new") return "Create poll"
  if (safePath === "/settings") return "Settings"
  if (safePath === "/profile") return "Profile"
  if (safePath === "/login") return "Sign in"
  if (safePath === "/register") return "Create account"
  if (/^\/poll\/[^/]+\/results\/?$/.test(safePath)) return "Poll results"
  if (/^\/poll\/[^/]+\/?$/.test(safePath)) return "Poll details"

  const segments = safePath.split("/").filter(Boolean)
  if (segments.length === 0) return "Home"

  const finalSegment = segments[segments.length - 1]
  const label = decodeURIComponent(finalSegment).replace(/[-_]+/g, " ").trim()
  if (!label) return "App"

  return toTitleCase(label)
}

export function getCreatePollPath(): string {
  return "/poll/new"
}

function cookieBaseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  }
}

function authHeaders(config: { anonKey: string }) {
  return {
    "Content-Type": "application/json",
    apikey: config.anonKey,
  }
}

async function supabaseFetch<T>(
  endpoint: string,
  init: RequestInit
): Promise<AuthApiResponse<T>> {
  const config = getSupabaseConfig()
  if (!config) {
    return { data: null, error: "Supabase is not configured" }
  }

  try {
    const response = await fetch(`${config.url}${endpoint}`, {
      ...init,
      headers: {
        ...authHeaders(config),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return { data: null, error: parseSupabaseError(payload) }
    }

    return { data: payload as T, error: null }
  } catch {
    return { data: null, error: "Unable to reach Supabase" }
  }
}

export async function signInWithPassword(args: {
  email: string
  password: string
}): Promise<AuthApiResponse<SupabaseAuthSession>> {
  return supabaseFetch<SupabaseAuthSession>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: args.email, password: args.password }),
  })
}

export async function refreshSessionWithToken(
  refreshToken: string
): Promise<AuthApiResponse<SupabaseAuthSession>> {
  return supabaseFetch<SupabaseAuthSession>("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export async function signUpWithPassword(args: {
  email: string
  password: string
  fullName?: string
}): Promise<AuthApiResponse<SupabaseSignUpPayload>> {
  const metadata = args.fullName ? { full_name: args.fullName } : undefined

  return supabaseFetch<SupabaseSignUpPayload>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      password: args.password,
      ...(metadata ? { data: metadata } : {}),
    }),
  })
}

function extractSessionCandidate(candidate: {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  user?: SupabaseUser | null
} | null | undefined): SupabaseAuthSession | null {
  if (!candidate) return null

  const accessToken = candidate.access_token
  const refreshToken = candidate.refresh_token
  const expiresIn = candidate.expires_in
  const tokenType = candidate.token_type
  const user = candidate.user

  if (
    typeof accessToken === "string" &&
    typeof refreshToken === "string" &&
    typeof expiresIn === "number" &&
    typeof tokenType === "string" &&
    user &&
    typeof user.id === "string"
  ) {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: tokenType,
      user,
    }
  }

  return null
}

export function extractSessionFromSignUp(payload: SupabaseSignUpPayload): SupabaseAuthSession | null {
  return extractSessionCandidate(payload.session) ?? extractSessionCandidate(payload)
}

export function mapSignUpUser(payload: SupabaseSignUpPayload): AuthUser | null {
  const user = payload.user ?? payload.session?.user
  if (!user) return null
  return mapUser(user)
}

export async function getUserFromAccessToken(
  accessToken: string
): Promise<AuthApiResponse<AuthUser>> {
  const config = getSupabaseConfig()
  if (!config) {
    return { data: null, error: "Supabase is not configured" }
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return { data: null, error: parseSupabaseError(payload) }
    }

    const user = parseUserPayload(payload)
    if (!user) {
      return { data: null, error: "Authentication failed" }
    }

    return {
      data: mapUser(user),
      error: null,
    }
  } catch {
    return { data: null, error: "Unable to reach Supabase" }
  }
}

export function getAccessTokenFromCookies(cookieReader: CookieReader): string | null {
  return cookieReader.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export function getRefreshTokenFromCookies(cookieReader: CookieReader): string | null {
  return cookieReader.get(REFRESH_TOKEN_COOKIE)?.value ?? null
}

export async function updateCurrentUserProfile(args: {
  accessToken: string
  email?: string
  password?: string
  fullName?: string | null
}): Promise<AuthApiResponse<AuthUser>> {
  const config = getSupabaseConfig()
  if (!config) {
    return { data: null, error: "Supabase is not configured" }
  }

  const body: Record<string, unknown> = {}
  if (typeof args.email === "string") {
    body.email = args.email
  }
  if (typeof args.password === "string") {
    body.password = args.password
  }
  if (args.fullName !== undefined) {
    body.data = { full_name: args.fullName, name: args.fullName }
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
        Authorization: `Bearer ${args.accessToken}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return { data: null, error: parseSupabaseError(payload) }
    }

    const user = parseUserPayload(payload)
    if (!user) {
      return { data: null, error: "Profile update failed" }
    }

    return { data: mapUser(user), error: null }
  } catch {
    return { data: null, error: "Unable to reach Supabase" }
  }
}

export async function deleteAuthUserById(userId: string): Promise<{ error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return { error: "Account deletion requires SUPABASE_SERVICE_ROLE_KEY" }
  }

  try {
    const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return { error: parseSupabaseError(payload) }
    }

    return { error: null }
  } catch {
    return { error: "Unable to reach Supabase" }
  }
}

export async function getCurrentUserFromCookies(cookieReader: CookieReader): Promise<AuthUser | null> {
  const accessToken = cookieReader.get(ACCESS_TOKEN_COOKIE)?.value
  if (accessToken) {
    const result = await getUserFromAccessToken(accessToken)
    if (result.data) {
      return result.data
    }
  }

  const refreshToken = cookieReader.get(REFRESH_TOKEN_COOKIE)?.value
  if (!refreshToken) {
    return null
  }

  const refreshResult = await refreshSessionWithToken(refreshToken)
  if (!refreshResult.data) {
    return null
  }

  return mapSessionUser(refreshResult.data)
}

export function setAuthCookies(response: NextResponse, session: SupabaseAuthSession) {
  const options = cookieBaseOptions()

  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...options,
    maxAge: Math.max(session.expires_in, 60),
  })

  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...options,
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    ...cookieBaseOptions(),
    maxAge: 0,
  })
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    ...cookieBaseOptions(),
    maxAge: 0,
  })
}

export function mapSessionUser(session: SupabaseAuthSession): AuthUser {
  return mapUser(session.user)
}
