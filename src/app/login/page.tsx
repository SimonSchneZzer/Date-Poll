import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import { LoginForm } from "@/components/auth/LoginForm"
import {
  getCurrentUserFromCookies,
  isSupabaseConfigured,
  normalizeNextPath,
} from "@/lib/auth/supabase-auth"

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

function mapLoginError(error: string | undefined): string | null {
  if (!error) return null

  return decodeURIComponent(error).replace(/_/g, " ")
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const nextPath = normalizeNextPath(params.next)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (user) {
    redirect(nextPath)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 md:p-10">
      <LoginForm
        nextPath={nextPath}
        configured={isSupabaseConfigured()}
        initialError={mapLoginError(params.error)}
      />
    </main>
  )
}
