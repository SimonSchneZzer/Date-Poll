import { NextRequest, NextResponse } from "next/server"

import { getCurrentUserFromCookies } from "@/lib/auth/supabase-auth"
import { createPoll } from "@/lib/date-poll/store"
import { parseOptionsInput } from "@/lib/date-poll/validation"

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromCookies(request.cookies)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json()) as {
    title?: string
    description?: string
    timezone?: string
    options?: string[]
    optionsText?: string
  }

  const options = Array.isArray(payload.options)
    ? payload.options.filter((option): option is string => typeof option === "string")
    : parseOptionsInput(payload.optionsText ?? "")

  const result = await createPoll({
    title: payload.title ?? "",
    description: payload.description,
    timezone: payload.timezone ?? "Europe/Vienna",
    options,
    creatorUserId: user.id,
  })

  if (result.errors) {
    return NextResponse.json({ errors: result.errors }, { status: 400 })
  }

  const pollId = result.poll!.id
  return NextResponse.json({ pollId, path: `/poll/${pollId}` }, { status: 201 })
}
