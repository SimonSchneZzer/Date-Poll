import "server-only"

import { cookies } from "next/headers"
import { cache } from "react"

import { getCurrentUserFromCookies, type AuthUser } from "@/lib/auth/supabase-auth"
import type { AccountPollSummary } from "@/lib/date-poll/account-polls"
import { getPollSummariesForUser } from "@/lib/date-poll/store"

export const getRequestUserAndPolls = cache(
  async (): Promise<{ user: AuthUser | null; polls: AccountPollSummary[] }> => {
    const cookieStore = await cookies()
    const user = await getCurrentUserFromCookies(cookieStore)
    const polls = user ? await getPollSummariesForUser(user.id) : []

    return { user, polls }
  }
)
