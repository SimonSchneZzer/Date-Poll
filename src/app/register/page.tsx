import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { RegisterForm } from "@/components/auth/RegisterForm"
import {
  getCurrentUserFromCookies,
  isSupabaseConfigured,
  normalizeNextPath,
} from "@/lib/auth/supabase-auth"

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

function mapRegisterError(error: string | undefined): string | null {
  if (!error) return null
  return decodeURIComponent(error).replace(/_/g, " ")
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  const nextPath = normalizeNextPath(params.next)
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (user) {
    redirect(nextPath)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 md:p-10">
      <RegisterForm
        nextPath={nextPath}
        configured={isSupabaseConfigured()}
        initialError={mapRegisterError(params.error)}
      />
    </main>
  )
}
