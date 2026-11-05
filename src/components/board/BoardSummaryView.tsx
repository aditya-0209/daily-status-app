"use client"

import { useState, useRef, useEffect } from "react"
import { cn, getInitials } from "@/lib/utils"
import { RichTextContent } from "@/components/ui/RichTextEditor"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts"
import type { Issue, WorkflowStatus, Sprint } from "@/types/database"

type Member = { id: string; name: string; avatar_color: string }
type Comment = {
  id: string; content: string; created_at: string; user_id: string
  user: { name: string; avatar_color: string } | null
  issue: { title: string } | null
}
type Stats = { completed: number; created: number; dueSoon: number; overdue: number }

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#f54260",
  high: "#f5a524",
  medium: "#5e6ad2",
  low: "#26d97f",
  no_priority: "#6b6b6b",
}

const TYPE_COLORS: Record<string, string> = {
  epic: "#8b5cf6",
  story: "#5e6ad2",
  task: "#26d97f",
  bug: "#f54260",
}

/* ── Stat card ───────────────────────────────────── */

function StatCard({ label, value, sub, color }: {
  label: string; value: number; sub: string; color: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[28px] font-bold" style={{ color }}>{value}</p>
      <p className="text-[13px] font-medium mt-0.5">{label}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

/* ── Chat ────────────────────────────────────────── */

function AiChat({ boardId, sampleName }: { boardId: string; sampleName?: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", text: msg }])
    setLoading(true)
    try {
      const res = await fetch("/api/board-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setMessages(prev => [...prev, { role: "ai", text: data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: err instanceof Error ? err.message : "Something went wrong." }])
    } finally {
      setLoading(false)
    }
  }

  const firstName = sampleName?.split(" ")[0]
  const suggestions = [
    "Give me today's team status summary",
    "What will everyone get done today?",
    firstName ? `What's ${firstName}'s update today?` : "Summarize someone's day today",
    "Summary for this week",
    "This sprint summary",
  ]

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col h-[420px]">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-[13px] font-semibold">AI Assistant</p>
        <p className="text-[11px] text-muted-foreground">Ask anything about your board, sprint, or backlog</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Try asking:</p>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="block w-full text-left text-[12px] px-3 py-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
            {m.role === "ai" && (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                </svg>
              </div>
            )}
            <div className={cn(
              "max-w-[85%] px-3 py-2 rounded-lg text-[12.5px] leading-relaxed",
              m.role === "user"
                ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                : "bg-secondary text-foreground"
            )}>
              {m.role === "ai"
                ? <RichTextContent html={m.text} className="text-[12.5px]" />
                : m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
            </div>
            <div className="bg-secondary px-3 py-2 rounded-lg flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your sprint, backlog, team…"
            disabled={loading}
            className="flex-1 h-8 px-3 text-[12px] bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-8 px-3 text-[12px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Main ────────────────────────────────────────── */

export function BoardSummaryView({
  boardId, issues, statuses, members, recentComments, sprints, stats,
}: {
  boardId: string
  issues: Issue[]
  statuses: WorkflowStatus[]
  members: Member[]
  recentComments: Comment[]
  sprints: Sprint[]
  stats: Stats
}) {
  // Status distribution for donut
  const statusData = statuses.map(s => ({
    name: s.name,
    value: issues.filter(i => i.status_id === s.id).length,
    color: s.color,
  })).filter(s => s.value > 0)

  // Priority distribution for bar chart
  const priorityData = ["urgent","high","medium","low","no_priority"].map(p => ({
    name: p === "no_priority" ? "None" : p.charAt(0).toUpperCase() + p.slice(1),
    count: issues.filter(i => i.priority === p).length,
    fill: PRIORITY_COLORS[p],
  })).filter(p => p.count > 0)

  // Types of work
  const typeData = ["epic","story","task","bug"].map(t => {
    const count = issues.filter(i => i.type === t).length
    const pct = issues.length > 0 ? Math.round((count / issues.length) * 100) : 0
    return { type: t, count, pct, color: TYPE_COLORS[t] ?? "#6b6b6b" }
  }).filter(t => t.count > 0)

  // Team workload
  const workloadData = members.map(m => {
    const assigned = issues.filter(i => i.assignee_id === m.id).length
    const pct = issues.length > 0 ? Math.round((assigned / issues.length) * 100) : 0
    return { member: m, count: assigned, pct }
  }).filter(w => w.count > 0).sort((a, b) => b.count - a.count).slice(0, 8)

  // Epic progress
  const epicIssues = issues.filter(i => i.type === "epic")

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Completed" value={stats.completed} sub="in the last 7 days" color="#26d97f" />
        <StatCard label="Created" value={stats.created} sub="in the last 7 days" color="#5e6ad2" />
        <StatCard label="Due soon" value={stats.dueSoon} sub="in the next 7 days" color="#f5a524" />
        <StatCard label="Overdue" value={stats.overdue} sub="past due date" color="#f54260" />
      </div>

      {/* ── Main 2-column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Status overview donut */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-1">Status overview</p>
          <p className="text-[11px] text-muted-foreground mb-3">{issues.length} total work items</p>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={0}>
                    {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1 min-w-0">
                {statusData.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-muted-foreground truncate flex-1">{s.name}</span>
                    <span className="font-medium tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground py-6 text-center">No issues yet</p>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-3">Recent activity</p>
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
            {recentComments.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">No recent activity</p>
            ) : recentComments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: c.user?.avatar_color ?? "#6b6b6b" }}
                >
                  {getInitials(c.user?.name ?? "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px]">
                    <span className="font-medium">{c.user?.name ?? "Someone"}</span>
                    <span className="text-muted-foreground"> commented on </span>
                    <span className="text-primary/80 truncate">{c.issue?.title ?? "an issue"}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.content}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Second row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Priority breakdown */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-3">Priority breakdown</p>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {priorityData.map((p, i) => <Cell key={i} fill={p.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[12px] text-muted-foreground text-center py-6">No issues yet</p>
          )}
        </div>

        {/* Types of work */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-3">Types of work</p>
          <div className="space-y-3">
            {typeData.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">No issues yet</p>
            ) : typeData.map(t => (
              <div key={t.type} className="flex items-center gap-3 text-[12px]">
                <span className="w-16 text-muted-foreground capitalize shrink-0">{t.type}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${t.pct}%`, backgroundColor: t.color }}
                  />
                </div>
                <span className="tabular-nums text-muted-foreground w-8 text-right">{t.pct}%</span>
                <span className="tabular-nums w-5 text-right font-medium">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Team workload + Epic progress ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Team workload */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-1">Team workload</p>
          <p className="text-[11px] text-muted-foreground mb-3">Issue distribution by assignee</p>
          <div className="space-y-2.5">
            {workloadData.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">No assignments yet</p>
            ) : workloadData.map(w => (
              <div key={w.member.id} className="flex items-center gap-2.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: w.member.avatar_color }}
                  title={w.member.name}
                >
                  {getInitials(w.member.name)}
                </div>
                <span className="text-[12px] w-28 truncate shrink-0">{w.member.name}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/60" style={{ width: `${w.pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{w.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Epic progress */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[13px] font-semibold mb-1">Epic progress</p>
          <p className="text-[11px] text-muted-foreground mb-3">Based on linked issue statuses</p>
          <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
            {epicIssues.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">No epics yet</p>
            ) : epicIssues.map(epic => {
              const ws = (epic as any).workflow_status
              const color = ws?.color ?? "#8b5cf6"
              const isDone = ws?.category === "done"
              return (
                <div key={epic.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[12px] flex-1 truncate">{epic.title}</span>
                    {ws && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: ws.color, backgroundColor: ws.color + "20" }}>
                        {ws.name}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: isDone ? "100%" : "0%", backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── AI Chat ── */}
      <AiChat boardId={boardId} sampleName={members[0]?.name} />
    </div>
  )
}
