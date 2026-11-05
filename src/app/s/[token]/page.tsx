import { createServiceClient } from "@/lib/supabase/server"
import type { DailySummary, Insight } from "@/types/database"

const STATUS_COLORS: Record<string, string> = {
  blocker: "#f54260",
  risk: "#f5a524",
  reminder: "#5e6ad2",
  kudos: "#26d97f",
  suggestion: "#a78bfa",
}

function InsightBadge({ type }: { type: string }) {
  const color = STATUS_COLORS[type] ?? "#5e6ad2"
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
    >
      {type}
    </span>
  )
}

function parseParagraphs(text: string) {
  return text.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean)
}

export default async function PublicSummaryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const service = createServiceClient()

  const { data: summary } = await service
    .from("daily_summaries")
    .select("*, teams(name)")
    .eq("share_token", token)
    .maybeSingle() as {
    data: (DailySummary & { teams: { name: string } | null }) | null
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[15px] font-semibold text-foreground">Summary not found</p>
          <p className="text-[13px] text-muted-foreground">This link may have expired or is invalid.</p>
        </div>
      </div>
    )
  }

  const date = new Date(summary.summary_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata",
  })

  const insights: Insight[] = Array.isArray(summary.insights) ? summary.insights : []

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-[4px] bg-[#5e6ad2] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="1" fill="white" />
                <rect x="7" y="1" width="4" height="4" rx="1" fill="white" opacity="0.5" />
                <rect x="1" y="7" width="4" height="4" rx="1" fill="white" opacity="0.5" />
                <rect x="7" y="7" width="4" height="4" rx="1" fill="white" opacity="0.25" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-[#f0f0f0]/80">
              {summary.teams?.name ?? "Daily Status"}
            </span>
          </div>
          <h1 className="text-[18px] font-semibold">Daily team status</h1>
          <p className="text-[13px] text-[#6b6b6b]">{date}</p>
        </div>

        {/* Summary */}
        <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-lg p-5 space-y-3">
          {parseParagraphs(summary.summary_text).map((p, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-[#f0f0f0]/90">{p}</p>
          ))}
          <p className="text-[10px] text-[#6b6b6b] pt-1">
            Generated {new Date(summary.generated_at).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
            })}
          </p>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-[#6b6b6b] uppercase tracking-wider">Insights</p>
            <div className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-lg divide-y divide-[rgba(255,255,255,0.06)]">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-[76px] shrink-0 pt-px">
                    <InsightBadge type={insight.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug mb-0.5">{insight.title}</p>
                    <p className="text-[12px] text-[#6b6b6b] leading-relaxed">{insight.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[11px] text-[#6b6b6b] text-center pb-4">
          Shared via Daily Status · Read-only view
        </p>
      </div>
    </div>
  )
}
