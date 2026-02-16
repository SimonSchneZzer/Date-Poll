import { cookies } from "next/headers"

import { HomePollsDashboard } from "@/components/date-poll/HomePollsDashboard"
import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { getPollSummariesForUser } from "@/lib/date-poll/store"

export default async function Home() {
  const cookieStore = await cookies()
  const currentUser = await getCurrentUserFromCookies(cookieStore)
  const initialAccountPolls = currentUser
    ? getPollSummariesForUser(currentUser.id)
    : []

  return (
    <HomePollsDashboard initialUser={currentUser} initialAccountPolls={initialAccountPolls} />
  )
}
