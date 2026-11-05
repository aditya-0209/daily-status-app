import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  resolveTimeframe, istDayStartInstant, istDayEndInstant, fmtDate, todayIST,
} from "@/lib/date"
import Groq from "groq-sdk"

type Member = { id: string; name: string }
type StatusRow = { id: string; name: string; category: string }

function queryFailure(label: string, error: { message: string; code?: string }) {
  console.error(`[board-chat] ${label}:`, error)
  const migrationHint = error.code === "PGRST204" && error.message.includes("tagged_issues")
    ? " Run supabase/schema-sod-eod.sql in Supabase SQL Editor, then retry."
    : ""
  return NextResponse.json(
    { error: `${label}: ${error.message}.${migrationHint}` },
    { status: 500 }
  )
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const boardId = body?.boardId
  const message = body?.message
  if (typeof boardId !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "boardId and message required" }, { status: 400 })
  }

  // Admin-only (daily status data can be personal)
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  if (profileError) return queryFailure("Failed to load your profile", profileError)
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })
  if (profile.role !== "admin") return NextResponse.json({ error: "admin_only" }, { status: 403 })

  const teamId = profile.team_id
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .eq("team_id", teamId)
    .maybeSingle()
  if (boardError) return queryFailure("Failed to verify board", boardError)
  if (!board) return NextResponse.json({ error: "board_not_found" }, { status: 404 })

  const q: string = message.trim()
  const t = q.toLowerCase()
  const origin = new URL(req.url).origin
  const ticketUrl = (id: string) => `${origin}/dashboard/issue/${id}`

  // ── Intent detection ──────────────────────────────────────────────────────
  const hasToday = /\btoday\b/.test(t)
  const sodIntent = /\bstart of (the )?day\b|\bsod\b|\bmorning\b|today'?s plan|plan(ning)?( for)? today/.test(t)
  const eodIntent = /\bend of (the )?day\b|\beod\b|\baccomplish/.test(t)
  const daySummary = /summary of (the )?day|day summary|today'?s summary|(daily|today).*summary/.test(t) || (/\bsummary\b/.test(t) && hasToday)
  // Explicit ticket / metric / range queries — these override the "today plan" view
  const hardTicketIntent = /\btickets?\b|\bissues?\b|\bbacklog\b|\bsprint\b|\bstory\b|\bstories\b|\bepics?\b|\bbugs?\b|how many|story ?points?|velocity|assigned|workload|capacity|open items?|\bcount\b/.test(t)
  // Soft "what are they doing" phrasing — routes to SOD when about today, else tickets
  const softWork = /working on|work on|worked on|\bdoing\b|focus(ing)? on|up to/.test(t)

  const timeframe = resolveTimeframe(q)
  const isRangey = ["week", "lastweek", "month", "lastmonth", "sprint"].includes(timeframe.kind)

  // "Today plan" context: anything about today that isn't an explicit ticket/range query
  const todayContext = hasToday && !hardTicketIntent && !isRangey

  const includeSOD = sodIntent || daySummary || todayContext
  const includeEOD = daySummary || eodIntent
  const includeTickets = hardTicketIntent || isRangey || (softWork && !hasToday) || (!includeSOD && !includeEOD)

  // ── Members + named-person detection ──────────────────────────────────────
  const { data: membersData, error: membersError } = await supabase
    .from("profiles").select("id, name").eq("team_id", teamId).eq("is_active", true)
  if (membersError) return queryFailure("Failed to load team members", membersError)
  const members = (membersData ?? []) as Member[]
  const namedPerson = members.find(m => {
    const full = m.name?.toLowerCase() ?? ""
    const first = full.split(" ")[0]
    return full && (t.includes(full) || (first.length > 2 && new RegExp(`\\b${first}\\b`).test(t)))
  }) ?? null

  // ── Statuses (for done/in-progress detection) ─────────────────────────────
  const { data: statusesData, error: statusesError } = await supabase
    .from("workflow_statuses").select("id, name, category").eq("board_id", boardId)
  if (statusesError) return queryFailure("Failed to load board statuses", statusesError)
  const statuses = (statusesData ?? []) as StatusRow[]
  const statusMap = new Map(statuses.map(s => [s.id, s]))
  const catOf = (id: string | null) => (id ? statusMap.get(id)?.category ?? "todo" : "todo")

  // ── Resolve sprint window if asked about "sprint" ─────────────────────────
  let sprintLabel = timeframe.label
  let sprintRange: { start: string; end: string } | null = null
  let activeSprintId: string | null = null
  if (timeframe.kind === "sprint" || includeTickets) {
    const { data: activeSprint, error: sprintError } = await supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("board_id", boardId).eq("status", "active")
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle()
    if (sprintError) return queryFailure("Failed to load active sprint", sprintError)
    if (activeSprint) {
      activeSprintId = activeSprint.id
      if (timeframe.kind === "sprint") {
        sprintLabel = `sprint "${activeSprint.name}"`
        if (activeSprint.start_date && activeSprint.end_date) {
          sprintRange = { start: activeSprint.start_date, end: activeSprint.end_date }
        }
      }
    }
  }

  // ── Gather daily status data (SOD / EOD) ─────
  let sodText = ""
  let eodText = ""
  if (includeSOD || includeEOD) {
    const start = timeframe.start
    const end = timeframe.end

    let checkins: any[] = []
    let eods: any[] = []
    if (includeSOD) {
      let cq = supabase.from("checkins")
        .select("todos, blockers, risk, risk_note, checkin_date, tagged_issues, profiles(name), user_id")
        .eq("team_id", teamId).gte("checkin_date", start).lte("checkin_date", end)
      if (namedPerson) cq = cq.eq("user_id", namedPerson.id)
      const { data, error } = await cq
      if (error) return queryFailure("Failed to load check-ins", error)
      checkins = data ?? []
    }
    if (includeEOD) {
      let eq = supabase.from("eod_updates")
        .select("accomplished, pending, status, completion_pct, confidence, risk, risk_note, quality_gate, eod_date, tagged_issues, profiles(name), user_id")
        .eq("team_id", teamId).gte("eod_date", start).lte("eod_date", end)
      if (namedPerson) eq = eq.eq("user_id", namedPerson.id)
      const { data, error } = await eq
      if (error) return queryFailure("Failed to load end-of-day updates", error)
      eods = data ?? []
    }

    const taggedIds = new Set<string>()
    for (const c of checkins)
      for (const ti of (c.tagged_issues ?? []) as { issue_id: string }[]) if (ti?.issue_id) taggedIds.add(ti.issue_id)
    for (const e of eods)
      for (const ti of (e.tagged_issues ?? []) as { issue_id: string }[]) if (ti?.issue_id) taggedIds.add(ti.issue_id)

    const ticketInfo = new Map<string, { label: string }>()
    if (taggedIds.size > 0) {
      const { data: tIssues, error: taggedIssuesError } = await supabase
        .from("issues")
        .select("id, issue_number, title, type, priority, status_id, board:board_id(key)")
        .in("id", [...taggedIds])
      if (taggedIssuesError) return queryFailure("Failed to load tagged issues", taggedIssuesError)
      for (const i of (tIssues ?? []) as any[]) {
        const key = i.board?.key ?? "ISSUE"
        const st = statusMap.get(i.status_id)?.name ?? "no status"
        ticketInfo.set(i.id, { label: `<a href="${ticketUrl(i.id)}">${key}-${i.issue_number}</a> "${i.title}" [${i.type}, ${i.priority} priority, status: ${st}]` })
      }
    }

    const renderTagged = (arr: any[], withOutcome: boolean) =>
      (arr ?? [])
        .map((ti: any) => {
          const info = ticketInfo.get(ti.issue_id)
          if (!info) return null
          const outcome = withOutcome && ti.outcome ? ` → ${ti.outcome}` : ""
          const note = ti.note ? ` (note: ${ti.note})` : ""
          return `    • ${info.label}${outcome}${note}`
        })
        .filter(Boolean)
        .join("\n")

    if (includeSOD) {
      sodText = checkins.length
        ? checkins.map((c: any) => {
            const tickets = renderTagged(c.tagged_issues, false)
            const risk = `\n  RISK TO TIMELINE: ${c.risk ? `yes — ${c.risk_note ?? ""}` : "no"}`
            const blocker = `\n  BLOCKER: ${c.blockers ? c.blockers : "no"}`
            return `${c.profiles?.name ?? "?"} (${fmtDate(c.checkin_date)}):\n  Goal (done by EOD): ${c.todos || "—"}${blocker}${risk}${tickets ? `\n  Tickets tagged:\n${tickets}` : ""}`
          }).join("\n\n")
        : "No start-of-day check-ins in this range."
    }
    if (includeEOD) {
      eodText = eods.length
        ? eods.map((e: any) => {
            const tickets = renderTagged(e.tagged_issues, true)
            const pct = e.completion_pct != null ? `\n  Completion toward final delivery: ${e.completion_pct}%` : ""
            const conf = e.confidence ? `\n  Confidence in next commitment: ${e.confidence}` : ""
            const risk = `\n  RISK TO TIMELINE: ${e.risk ? `yes — ${e.risk_note ?? ""}` : "no"}`
            const blockedItems = (e.tagged_issues ?? []).filter((t: any) => t.outcome === "blocked")
            const blocker = `\n  BLOCKER: ${blockedItems.length ? "yes" : "no"}`
            const qg = e.quality_gate
            const qgText = qg
              ? `\n  Quality gate: Requirements/PRD ${qg.matches_prd ? "met" : "not met"}, Dev/QA ${qg.dev_qa ? "done" : "not done"}, ${qg.needs_review ? `needs review (${qg.review_what_whom ?? ""})` : "no review needed"}`
              : ""
            return `${e.profiles?.name ?? "?"} (${fmtDate(e.eod_date)}, ${e.status}):\n  Shipped: ${e.accomplished || "—"}${e.pending ? `\n  PENDING: ${e.pending}` : ""}${pct}${conf}${blocker}${risk}${qgText}${tickets ? `\n  Tickets worked:\n${tickets}` : ""}`
          }).join("\n\n")
        : "No end-of-day updates in this range."
    }
  }

  // ── Gather ticket data ────────────────────────────────────────────────────
  let ticketText = ""
  let workloadText = ""
  if (includeTickets) {
    const sel = "id, issue_number, title, type, priority, status_id, assignee_id, story_points, due_date, updated_at, sprint_id, board:board_id(key)"
    let iq = supabase.from("issues").select(sel).eq("board_id", boardId).neq("type", "subtask")

    if (timeframe.kind === "sprint" && activeSprintId) {
      iq = iq.eq("sprint_id", activeSprintId)
    } else if (isRangey) {
      const range = sprintRange ?? { start: timeframe.start, end: timeframe.end }
      iq = iq.gte("updated_at", istDayStartInstant(range.start)).lte("updated_at", istDayEndInstant(range.end))
    } else if ((hardTicketIntent || softWork) && (timeframe.kind === "today" || timeframe.kind === "yesterday") && hasToday) {
      iq = iq.gte("updated_at", istDayStartInstant(timeframe.start)).lte("updated_at", istDayEndInstant(timeframe.end))
    }
    if (namedPerson) iq = iq.eq("assignee_id", namedPerson.id)
    iq = iq.limit(120)

    const { data: issues, error: issuesError } = await iq
    if (issuesError) return queryFailure("Failed to load board issues", issuesError)
    const nameOf = (id: string | null) => members.find(m => m.id === id)?.name ?? "unassigned"
    const list = (issues ?? []) as any[]
    ticketText = list.length
      ? list.map((i) => {
          const cat = catOf(i.status_id)
          const st = statusMap.get(i.status_id)?.name ?? "unknown"
          const key = i.board?.key ?? "ISSUE"
          return `- <a href="${ticketUrl(i.id)}">${key}-${i.issue_number}</a> [${i.type}] ${i.title} | status: ${st} (${cat}) | priority: ${i.priority} | points: ${i.story_points ?? "-"} | assignee: ${nameOf(i.assignee_id)} | updated: ${fmtDate(i.updated_at)}${i.due_date ? ` | due: ${fmtDate(i.due_date)}` : ""}`
        }).join("\n")
      : "No matching tickets."

    // Per-assignee workload snapshot (helps "how many" / "what is X working on")
    const counts = new Map<string, { todo: number; inprog: number; done: number }>()
    for (const i of list) {
      const who = nameOf(i.assignee_id)
      const c = counts.get(who) ?? { todo: 0, inprog: 0, done: 0 }
      const cat = catOf(i.status_id)
      if (cat === "done") c.done++
      else if (cat === "in_progress") c.inprog++
      else c.todo++
      counts.set(who, c)
    }
    workloadText = [...counts.entries()]
      .map(([who, c]) => `${who}: ${c.inprog} in progress, ${c.todo} to do, ${c.done} done`)
      .join("\n")
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const personScope = namedPerson ? ` Focused on ${namedPerson.name}.` : ""
  const sections: string[] = []
  if (sodText) sections.push(`START-OF-DAY check-ins (what people planned to work on):\n${sodText}`)
  if (eodText) sections.push(`END-OF-DAY updates (what people actually did):\n${eodText}`)
  if (ticketText) sections.push(`TICKETS for ${timeframe.kind === "sprint" ? sprintLabel : timeframe.label}:\n${ticketText}`)
  if (workloadText) sections.push(`Per-person ticket workload:\n${workloadText}`)

  const guidance = `Routing rules:
- For "start of the day" questions, answer from START-OF-DAY check-ins only — what each person SAID they'd work on today, not their full ticket list.
- For "summary of the day"/"today" questions, combine START-OF-DAY and END-OF-DAY.
- For ticket / sprint / "this week"/"this month" / "how many" / "what is X working on" questions, answer from TICKETS and workload.
- A person may have many tickets assigned but only be working on what their check-in says today. Respect that.

When the question asks for a person's update / a daily summary / "what's everyone doing",
render ONE structured block PER PERSON using EXACTLY these labels (omit a line only if
there is genuinely no data for it; never invent values):

<p><strong>{Person name}</strong></p>
<ul>
<li><strong>Daily goal:</strong> {what will be done by EOD — from the check-in goal}</li>
<li><strong>What shipped since last update:</strong> {from EOD "Shipped"}</li>
<li><strong>% of overall work completed:</strong> {completion %}</li>
<li><strong>Blockers / asks:</strong> {what they need + by when — or "None"}</li>
<li><strong>Risk to timeline:</strong> {Yes — why / No}</li>
<li><strong>Quality gate:</strong> Requirements/PRD {met / not met} · Dev/QA {done / not done} · {needs review — what & from whom / no review needed}</li>
</ul>

- For the quality gate use plain words (met / not met, done / not done) — never emoji or checkbox glyphs.
- Reference the person's tagged/related tickets inline as the exact <a> anchors provided.
- Pull in PAST SOD/EOD and tickets when the question implies it (e.g. "this week", a past date)
  or when they add context to today's update — the data section already reflects the requested range.

Writing style (important):
- Include EVERY person present in the data — never drop anyone who submitted a check-in/EOD or has relevant tickets.
- Write for a NON-TECHNICAL audience (product managers, CEO, scrum masters): rephrase jargon into plain-language outcomes. SUMMARISE — don't copy the raw text verbatim.
- For free-form questions that aren't a per-person summary, answer naturally (still in HTML), not in the template.

Output format — respond in clean, simple HTML (rendered as rich text):
- Use <p>, <strong>, <ul>/<li>, <em>. No headings, tables, inline styles, or <html>/<body> wrappers.
- Render EVERY ticket reference as the exact anchor tag from the data, e.g. <a href="...">UPLYL-52</a>. Never output a bare ID or invent a URL.
- Today is ${fmtDate(todayIST())} (IST). Reference real names. If the data doesn't contain the answer, say so briefly — don't guess.`

  const context = sections.join("\n\n") || "No relevant data found for this question."

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 503 })
  }

  try {
    const groq = new Groq({ apiKey })
    const res = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You are a project and daily status assistant for a software team. Be concise, specific, and actionable.${personScope}\n\n${guidance}`,
        },
        { role: "user", content: `${context}\n\nQuestion: ${q}` },
      ],
      max_tokens: 1100,
      temperature: 0.4,
    })
    const answer = res.choices[0]?.message?.content ?? "No response generated."
    return NextResponse.json({ answer })
  } catch (err) {
    console.error("[board-chat] Groq error:", err)
    return NextResponse.json({ error: "AI service unavailable" }, { status: 500 })
  }
}
