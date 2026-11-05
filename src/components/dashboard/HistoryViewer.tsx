"use client"

import { useState, useEffect, useCallback } from "react"
import { cn, getInitials } from "@/lib/utils"
import { todayIST, fmtDate } from "@/lib/date"
import { DailyStatusDetail } from "./DailyStatusDetail"

type Person = { id: string; name: string; avatar_color: string }
type Tagged = { issue_id: string; note?: string; outcome?: string }
type Checkin = {
  user_id: string; todos: string | null; blockers: string | null
  risk: boolean; risk_note: string | null; availability: string | null
  tagged_issues: Tagged[] | null; profiles: Person | null
}
type Eod = {
  user_id: string; accomplished: string | null; pending: string | null; status: string
  completion_pct: number | null; confidence: string | null; risk: boolean; risk_note: string | null
  quality_gate: { matches_prd?: boolean; dev_qa?: boolean; needs_review?: boolean; review_what_whom?: string | null } | null
  tagged_issues: Tagged[] | null; profiles: Person | null
}
type TicketMap = Record<string, { key: string; number: number; title: string }>

export function HistoryViewer() {
  const [date, setDate] = useState(todayIST())
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [eods, setEods] = useState<Eod[]>([])
  const [tickets, setTickets] = useState<TicketMap>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/history?date=${d}`)
      const data = await res.json()
      if (res.ok) { setCheckins(data.checkins); setEods(data.eods); setTickets(data.tickets) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  // Union of people who submitted SOD or EOD that day
  const people = new Map<string, Person>()
  for (const c of checkins) if (c.profiles) people.set(c.user_id, c.profiles)
  for (const e of eods) if (e.profiles) people.set(e.user_id, e.profiles)
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name))

  function shiftDay(delta: number) {
    const d = new Date(`${date}T12:00:00+05:30`)
    d.setUTCDate(d.getUTCDate() + delta)
    setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold">Daily status history</h2>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shiftDay(-1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Previous day">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <input
            type="date" value={date} max={todayIST()}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="h-7 px-2 text-[12px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={() => shiftDay(1)} disabled={date >= todayIST()} className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30" title="Next day">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">{fmtDate(date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</p>

      {loading ? (
        <div className="bg-card border border-border rounded-lg h-32 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No check-ins or EODs on this day</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(person => {
            const sod = checkins.find(c => c.user_id === person.id)
            const eod = eods.find(e => e.user_id === person.id)
            return (
              <div key={person.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2 bg-card border-b border-border">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0" style={{ backgroundColor: person.avatar_color }}>
                    {getInitials(person.name)}
                  </div>
                  <span className="text-[13px] font-medium flex-1">{person.name}</span>
                  <span className="flex items-center gap-1.5">
                    <Tag on={!!sod} label="SOD" />
                    <Tag on={!!eod} label="EOD" />
                  </span>
                </div>

                <DailyStatusDetail sod={sod} eod={eod} tickets={tickets} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Tag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", on ? "bg-[#26d97f]/15 text-[#26d97f]" : "bg-muted text-muted-foreground/50")}>
      {label} {on ? "✓" : "—"}
    </span>
  )
}
