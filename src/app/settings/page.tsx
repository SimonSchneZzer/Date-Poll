import { redirect } from "next/navigation"

import { ProfileSettingsForm } from "@/components/auth/ProfileSettingsForm"
import { getRequestUserAndPolls } from "@/lib/date-poll/request-context"

export default async function SettingsPage() {
  const { user } = await getRequestUserAndPolls()

  if (!user) {
    redirect("/login?next=%2Fsettings")
  }

  return (
    <main className="p-4 sm:p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <ProfileSettingsForm initialUser={user} />
      </div>
    </main>
  )
}
