"use client"

import { cn } from "@/lib/utils"

/**
 * Shared SOD/EOD detail body — used by the admin History viewer (Overview) and
 * the "View all" team status panel so both look identical.
 * Always renders Risk-to-timeline and Blocker lines (showing "No" when absent).
 */

type Tagged = { issue_id: string; note?: string; outcome?: string }
type TicketMap = Record<string, { key: string; number: number; title: string }>

export type SodLike = {
  todos: string | null
  blockers: string | null
  risk?: boolean
  risk_note?: string | null
  availability?: string | null
  tagged_issues?: Tagged[] | null
} | undefined

export type EodLike = {
  accomplished: string | null
  pending: string | null
  status?: string
  completion_pct?: number | null
  confidence?: string | null
  risk?: boolean
  risk_note?: string | null
  quality_gate?: { matches_prd?: boolean; dev_qa?: boolean; needs_review?: boolean; review_what_whom?: string | null } | null
  tagged_issues?: Tagged[] | null
} | undefined

export function DailyStatusDetail({ sod, eod, tickets }: { sod: SodLike; eod: EodLike; tickets?: TicketMap }) {
  const ticketLabel = (t: Tagged) => {
    const info = tickets?.[t.issue_id]
    return info ? `${info.key}-${info.number} ${info.title}` : (t.note || "ticket")
  }
  const eodBlocked = (eod?.tagged_issues ?? []).filter(t => t.outcome === "blocked")

  return (
    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60">
      {/* SOD */}
      <div className="p-3 space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Start of day</p>
        {sod ? (
          <div className="space-y-1.5 text-[12px]">
            <Field label="Goal (by EOD)" value={sod.todos} />
            {(sod.tagged_issues ?? []).length > 0 && (
              <Field label="Tickets" value={(sod.tagged_issues ?? []).map(ticketLabel).join(", ")} />
            )}
            <RiskLine on={!!sod.risk} note={sod.risk_note} />
            <BlockerLine value={sod.blockers} />
            {sod.availability && <Field label="Availability" value={sod.availability.replace("_", " ")} />}
          </div>
        ) : <p className="text-[12px] text-muted-foreground/50 italic">Not submitted</p>}
      </div>

      {/* EOD */}
      <div className="p-3 space-y-1.5">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">End of day</p>
        {eod ? (
          <div className="space-y-1.5 text-[12px]">
            <Field label="Shipped" value={eod.accomplished} />
            {eod.completion_pct != null && <Field label="Completion" value={`${eod.completion_pct}%`} />}
            {eod.confidence && <Field label="Confidence" value={eod.confidence} />}
            <RiskLine on={!!eod.risk} note={eod.risk_note} />
            <BlockerLine value={eodBlocked.length ? eodBlocked.map(b => b.note || "blocked ticket").join("; ") : null} />
            {eod.quality_gate && <QualityGate qg={eod.quality_gate} />}
            {eod.pending && <Field label="Pending" value={eod.pending} warn />}
          </div>
        ) : <p className="text-[12px] text-muted-foreground/50 italic">Not submitted</p>}
      </div>
    </div>
  )
}

function Field({ label, value, warn }: { label: string; value: string | null; warn?: boolean }) {
  if (!value) return null
  return (
    <p className="leading-relaxed">
      <span className="text-muted-foreground/70">{label}: </span>
      <span className={warn ? "text-[#f5a524]" : "text-foreground"}>{value}</span>
    </p>
  )
}

function RiskLine({ on, note }: { on: boolean; note: string | null | undefined }) {
  return (
    <p className="leading-relaxed">
      <span className="text-muted-foreground/70">Risk to timeline: </span>
      {on
        ? <span className="text-[#f54260] font-medium">Yes{note ? ` — ${note}` : ""}</span>
        : <span className="text-muted-foreground">No</span>}
    </p>
  )
}

function BlockerLine({ value }: { value: string | null | undefined }) {
  return (
    <p className="leading-relaxed">
      <span className="text-muted-foreground/70">Blocker: </span>
      {value
        ? <span className="text-[#f5a524]">{value}</span>
        : <span className="text-muted-foreground">No</span>}
    </p>
  )
}

function QualityGate({ qg }: { qg: { matches_prd?: boolean; dev_qa?: boolean; needs_review?: boolean; review_what_whom?: string | null } }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <span className="text-muted-foreground/70">Quality gate:</span>
      <GatePill on={!!qg.matches_prd} label="Requirements/PRD" />
      <GatePill on={!!qg.dev_qa} label="Dev/QA checks" />
      {qg.needs_review
        ? <GatePill attention label={qg.review_what_whom ? `Needs review — ${qg.review_what_whom}` : "Needs review"} />
        : <GatePill on label="No review needed" />}
    </div>
  )
}

function GatePill({ on, attention, label }: { on?: boolean; attention?: boolean; label: string }) {
  // bg / border / icon carry the colour; the text stays foreground for readability
  const tone = attention
    ? { color: "#f5a524", bg: "#f5a52415", border: "#f5a52433" }
    : on
      ? { color: "#26d97f", bg: "#26d97f12", border: "#26d97f2e" }
      : null
  const Icon = () => attention ? (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /><path d="M6 5v2.2M6 8.6v.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
  ) : on ? (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 8h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  )
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap text-foreground/90",
        !tone && "border border-border"
      )}
      style={tone ? { backgroundColor: tone.bg, border: `1px solid ${tone.border}` } : undefined}
    >
      <span style={{ color: tone ? tone.color : "var(--muted-foreground)" }} className="flex items-center"><Icon /></span>
      {label}
    </span>
  )
}
