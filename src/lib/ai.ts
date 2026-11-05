import Groq from "groq-sdk"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = "openai/gpt-oss-120b"

export interface ProjectContext {
  name: string
  status: string
  priority: string
  daysLeft: number | null
  totalMilestones: number
  doneMilestones: number
  activeDevs: string[]
}

export interface MemberContext {
  name: string
  availability: string   // 'working' | 'half_day' | 'remote'
  onLeave: boolean
  leaveType?: string     // 'full' | 'half'
}

// ── Summary prompt ──────────────────────────────────────────────────────────

function buildSummaryPrompt(
  morningData: string,
  eodData: string,
  projects: ProjectContext[],
  memberContext: MemberContext[] = []
): string {
  const projectSection = projects.length > 0
    ? `\n\nPROJECT PIPELINE:\n${projects.map((p) => {
      const deadline = p.daysLeft !== null
        ? (p.daysLeft < 0 ? `${Math.abs(p.daysLeft)}d overdue` : p.daysLeft === 0 ? "due today" : `${p.daysLeft}d left`)
        : "no deadline"
      const progress = p.totalMilestones > 0
        ? `${p.doneMilestones}/${p.totalMilestones} milestones done`
        : "no milestones"
      const devs = p.activeDevs.length > 0 ? `working: ${p.activeDevs.join(", ")}` : "no activity today"
      return `- ${p.name} [${p.status}, ${p.priority} priority, ${deadline}, ${progress}, ${devs}]`
    }).join("\n")}`
    : ""

  const onLeave = memberContext.filter((m) => m.onLeave)
  const halfDay = memberContext.filter((m) => !m.onLeave && m.availability === "half_day")
  const remote = memberContext.filter((m) => !m.onLeave && m.availability === "remote")

  const availSection = [
    onLeave.length > 0 ? `On leave today: ${onLeave.map((m) => `${m.name} (${m.leaveType ?? "full"} day)`).join(", ")}` : "",
    halfDay.length > 0 ? `Half day: ${halfDay.map((m) => m.name).join(", ")}` : "",
    remote.length > 0 ? `Remote: ${remote.map((m) => m.name).join(", ")}` : "",
  ].filter(Boolean).join("\n")

  return `You are a daily status recorder for a software team. Write a brief, factual team status summary.

STRICT RULES:
- Report only what team members explicitly wrote. Do not infer quality, risk, or success beyond the raw data.
- Never use phrases like "notable win", "poses a risk", "crucial to monitor", "significant achievement", or any judgment the user did not write.
- EOD status "partial" just means tasks were partially completed - do not flag it as a risk or concern.
- Members marked as on leave did NOT submit check-ins - do NOT flag them as "didn't submit".
- Scale length to the data: 1 person with 2 tasks = 2–3 sentences. No padding to hit a word count.
- Max 130 words. 1–3 short paragraphs. No bullet points. Plain prose.

${availSection ? `AVAILABILITY:\n${availSection}\n` : ""}
MORNING CHECK-INS:
${morningData}

EOD UPDATES:
${eodData}${projectSection}`
}

function buildPastContext(pastSummaries: string[], recentQA: string[]): string {
  const parts: string[] = []
  if (pastSummaries.length > 0) {
    parts.push(`RECENT SUMMARIES (for continuity - note carried-over work or recurring blockers):\n${pastSummaries.join("\n\n---\n\n")}`)
  }
  if (recentQA.length > 0) {
    parts.push(`RECENT ADMIN QUESTIONS (context from past discussions):\n${recentQA.join("\n\n")}`)
  }
  return parts.length > 0 ? `\n\n${parts.join("\n\n")}` : ""
}

// ── Insights prompt ──────────────────────────────────────────────────────────

function buildInsightsPrompt(
  morningData: string,
  eodData: string,
  projects: ProjectContext[],
  memberContext: MemberContext[] = []
): string {
  const projectSection = projects.length > 0
    ? `\nPROJECTS: ${projects.map((p) => {
      const overdue = p.daysLeft !== null && p.daysLeft < 0
      const atRisk = p.daysLeft !== null && p.daysLeft <= 3 && p.doneMilestones < p.totalMilestones
      return `${p.name}(${p.status},${overdue ? "OVERDUE" : p.daysLeft !== null ? p.daysLeft + "d" : "no-deadline"},${p.doneMilestones}/${p.totalMilestones}ms,${p.priority})${overdue ? "[OVERDUE]" : atRisk ? "[AT_RISK]" : ""}`
    }).join("; ")}`
    : ""

  const onLeave = memberContext.filter((m) => m.onLeave).map((m) => m.name)

  return `You are a daily status analyst. Return ONLY a valid JSON array - no markdown, no preamble.

Each item: { "type": "blocker"|"risk"|"reminder"|"kudos"|"suggestion", "title": "max 5 words", "detail": "one actionable sentence with names/projects" }

Type selection rules (strict):
- "blocker": ONLY if a user explicitly wrote a blocker in their check-in
- "risk": only for real project risks (overdue deadlines, important project with no deadline)
- "reminder": tasks mentioned in SOD but not reflected in EOD accomplished
- "kudos": explicitly completed work worth recognising
- "suggestion": process improvements genuinely useful to the team

Generate 3–5 insights. Do not invent risks from partial EOD status alone.
${onLeave.length > 0 ? `Members on leave (ignore missing submissions for these): ${onLeave.join(", ")}` : ""}

CHECKINS: ${morningData}
EOD: ${eodData}${projectSection}`
}

// ── Chat answer prompt ────────────────────────────────────────────────────────

function buildChatPrompt(
  question: string,
  context: {
    date: string
    morningData: string
    eodData: string
    projectData: string
    summaryText: string
    previousQA: string
    leaveData?: string
  }
): string {
  return `You are a daily status assistant. Answer the admin's question using only the team data below.

Rules:
- Be direct and specific. Reference names and project names from the data.
- If the answer isn't in the data, say so briefly - don't guess.
- Keep answers to 2–4 sentences. Use a short list only when it genuinely helps.

TEAM DATA for ${context.date}:

Morning check-ins:
${context.morningData || "None submitted."}

EOD updates:
${context.eodData || "None submitted."}
${context.leaveData ? `\nLeaves/availability:\n${context.leaveData}` : ""}
Projects:
${context.projectData || "No active projects."}
${context.summaryText ? `\nToday's summary:\n${context.summaryText}` : ""}
${context.previousQA ? `\nEarlier questions today:\n${context.previousQA}` : ""}

Admin question: ${question}`
}

// ── Exports ──────────────────────────────────────────────────────────────────

export function streamAISummary(
  morningData: string,
  eodData: string,
  projects: ProjectContext[] = [],
  pastSummaries: string[] = [],
  recentQA: string[] = [],
  memberContext: MemberContext[] = []
) {
  const prompt = buildSummaryPrompt(morningData, eodData, projects, memberContext)
    + buildPastContext(pastSummaries, recentQA)
  return groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.4,
    stream: true,
  })
}

export async function generateAISummary(
  morningData: string,
  eodData: string,
  projects: ProjectContext[] = [],
  pastSummaries: string[] = [],
  recentQA: string[] = [],
  memberContext: MemberContext[] = []
): Promise<string> {
  const prompt = buildSummaryPrompt(morningData, eodData, projects, memberContext)
    + buildPastContext(pastSummaries, recentQA)
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.4,
  })
  return res.choices[0].message.content ?? ""
}

export async function generateAIInsights(
  morningData: string,
  eodData: string,
  projects: ProjectContext[] = [],
  memberContext: MemberContext[] = []
) {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: buildInsightsPrompt(morningData, eodData, projects, memberContext) }],
    max_tokens: 600,
    temperature: 0.3,
  })
  const raw = res.choices[0].message.content ?? "[]"
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim())
  } catch {
    return []
  }
}

export function streamChatAnswer(
  question: string,
  context: {
    date: string
    morningData: string
    eodData: string
    projectData: string
    summaryText: string
    previousQA: string
    leaveData?: string
  }
) {
  return groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: buildChatPrompt(question, context) }],
    max_tokens: 300,
    temperature: 0.4,
    stream: true,
  })
}
