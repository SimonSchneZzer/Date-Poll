import { HomePollsDashboard } from "@/components/date-poll/HomePollsDashboard"
import { getRequestUserAndPolls } from "@/lib/date-poll/request-context"

export default async function Home() {
  const { user: currentUser, polls: initialAccountPolls } = await getRequestUserAndPolls()

  return <HomePollsDashboard initialUser={currentUser} initialAccountPolls={initialAccountPolls} />
}
