import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { CreatePollForm } from "@/components/date-poll/CreatePollForm"
import { getCreatePollPath, getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"

export default async function NewPollPage() {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(getCreatePollPath())}`)
  }

  return (
    <main className="p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <CreatePollForm />
      </div>
    </main>
  )
}
