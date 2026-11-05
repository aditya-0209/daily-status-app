import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { generateAISummary, generateAIInsights } from "@/lib/ai"
import { todayISO } from "@/lib/utils"

export async function GET(req: Request) {
  const secret = req.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = todayISO()

  // Get all teams
  const { data: teams } = await supabase.from("teams").select("id, name")

  for (const team of teams ?? []) {
    // Skip if summary already generated
    const { data: existing } = await supabase
      .from("daily_summaries")
      .select("id")
      .eq("team_id", team.id)
      .eq("summary_date", today)
      .maybeSingle()

    if (existing) continue

    const [{ data: checkins }, { data: eods }] = await Promise.all([
      supabase.from("checkins").select("*, profiles(name)").eq("team_id", team.id).eq("checkin_date", today),
      supabase.from("eod_updates").select("*, profiles(name)").eq("team_id", team.id).eq("eod_date", today),
    ])

    if (!checkins?.length) continue

    const morningData = (checkins as Array<{ profiles: { name: string }; todos: string; blockers?: string }>).map(
      (c) => `${c.profiles?.name}: ${c.todos}${c.blockers ? ` [BLOCKER: ${c.blockers}]` : ""}`
    ).join("\n")

    const eodData = eods?.length
      ? (eods as Array<{ profiles: { name: string }; accomplished: string; status: string; pending?: string }>).map(
          (e) => `${e.profiles?.name} (${e.status}): ${e.accomplished}`
        ).join("\n")
      : "No EOD updates yet."

    try {
      const [summaryText, insights] = await Promise.all([
        generateAISummary(morningData, eodData),
        generateAIInsights(morningData, eodData),
      ])

      await supabase.from("daily_summaries").insert({
        team_id: team.id,
        summary_date: today,
        summary_text: summaryText,
        insights,
      })

      console.log(`[CRON] Summary generated for team: ${team.name}`)
    } catch (err) {
      console.error(`[CRON] Failed for team ${team.name}:`, err)
    }
  }

  return NextResponse.json({ ok: true, date: today })
}
