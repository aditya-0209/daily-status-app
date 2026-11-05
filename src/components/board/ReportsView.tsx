"use client"

import { useMemo, useState } from "react"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import type { Sprint, Issue, WorkflowStatus } from "@/types/database"
import { cn } from "@/lib/utils"

/* ── helpers ─────────────────────────────────────── */

function sprintPoints(issues: Issue[]) {
  return issues.reduce((s, i) => s + (i.story_points ?? 0), 0)
}

function isoToMs(s: string | null | undefined) {
  return s ? new Date(s).getTime() : null
}

/* ── Burndown ────────────────────────────────────── */

function BurndownChart({ sprint, issues, statuses, now }: { sprint: Sprint; issues: Issue[]; statuses: WorkflowStatus[]; now: number }) {
  const startMs = isoToMs(sprint.start_date)
  const endMs = isoToMs(sprint.end_date)
  if (!startMs || !endMs) return (
    <p className="text-[12px] text-muted-foreground text-center py-8">Sprint has no dates set.</p>
  )
  if (issues.length === 0) return (
    <p className="text-[12px] text-muted-foreground text-center py-8">No issues in this sprint yet.</p>
  )

  const useStoryPoints = sprintPoints(issues) > 0
  const total = useStoryPoints ? sprintPoints(issues) : issues.length
  const completedIssues = issues.filter(i =>
    statuses.find(status => status.id === i.status_id)?.category === "done"
  )
  const completed = useStoryPoints
    ? sprintPoints(completedIssues)
    : completedIssues.length
  const totalDays = Math.max(1, Math.ceil((endMs - startMs) / 86400000))

  // Build ideal burndown line
  const data: { day: string; ideal: number; actual?: number }[] = []
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startMs + i * 86400000)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const ideal = Math.round(total * (1 - i / totalDays))
    data.push({ day: label, ideal })
  }

  // Actual: estimate progress from the current completion snapshot.
  // We don't have per-day completion history, so we show a snapshot at "today" vs end
  if (now >= startMs) {
    const daysElapsed = Math.min(totalDays, Math.ceil((now - startMs) / 86400000))
    for (let i = 0; i <= daysElapsed; i++) {
      const ratio = daysElapsed === 0 ? 0 : i / daysElapsed
      data[i].actual = Math.round(total - completed * ratio)
    }
  }

  return (
    <ResponsiveContainer width="100%" height={260} minWidth={0}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6b6b6b" }} interval="preserveStartEnd" />
        <YAxis domain={[0, Math.max(total, 1)]} allowDecimals={false} tick={{ fontSize: 10, fill: "#6b6b6b" }} />
        <Tooltip
          contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "#f0f0f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="ideal" stroke="#8b8b8b" strokeDasharray="4 4" dot={false} name={`Ideal ${useStoryPoints ? "points" : "issues"}`} />
        <Line type="monotone" dataKey="actual" stroke="#26d97f" strokeWidth={2} dot={false} name={`Actual ${useStoryPoints ? "points" : "issues"}`} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Velocity ────────────────────────────────────── */

function VelocityChart({ sprints, issues, statuses }: { sprints: Sprint[]; issues: Issue[]; statuses: WorkflowStatus[] }) {
  const useStoryPoints = sprints.some(sp =>
    sprintPoints(issues.filter(i => i.sprint_id === sp.id)) > 0
  )
  const data = sprints.map(sp => {
    const sprintIssues = issues.filter(i => i.sprint_id === sp.id)
    const completedIssues = sprintIssues.filter(i =>
      statuses.find(status => status.id === i.status_id)?.category === "done"
    )
    const committed = useStoryPoints ? sprintPoints(sprintIssues) : sprintIssues.length
    const completed = useStoryPoints ? sprintPoints(completedIssues) : completedIssues.length
    return { name: sp.name.length > 12 ? sp.name.slice(0, 12) + "…" : sp.name, committed, completed }
  })

  if (data.length === 0) return (
    <p className="text-[12px] text-muted-foreground text-center py-8">No sprints to display.</p>
  )

  return (
    <ResponsiveContainer width="100%" height={260} minWidth={0}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b6b6b" }} />
        <YAxis domain={[0, Math.max(1, ...data.map(d => d.committed))]} allowDecimals={false} tick={{ fontSize: 10, fill: "#6b6b6b" }} />
        <Tooltip
          contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "#f0f0f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="committed" fill="rgba(94,106,210,0.7)" radius={[3, 3, 0, 0]} name={`Committed ${useStoryPoints ? "points" : "issues"}`} />
        <Bar dataKey="completed" fill="#26d97f" radius={[3, 3, 0, 0]} name={`Completed ${useStoryPoints ? "points" : "issues"}`} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Sprint Summary Table ────────────────────────── */

function SprintSummary({ sprint, issues, statuses }: { sprint: Sprint; issues: Issue[]; statuses: WorkflowStatus[] }) {
  const sprintIssues = issues.filter(i => i.sprint_id === sprint.id)
  const total = sprintIssues.length
  const pts = sprintPoints(sprintIssues)
  const doneIssues = sprintIssues.filter(i =>
    statuses.find(status => status.id === i.status_id)?.category === "done"
  )
  const donePts = doneIssues.reduce((s, i) => s + (i.story_points ?? 0), 0)
  const completion = pts > 0
    ? Math.round((donePts / pts) * 100)
    : total > 0
      ? Math.round((doneIssues.length / total) * 100)
      : 0

  const byStatus = statuses.map(st => ({
    ...st,
    count: sprintIssues.filter(i => i.status_id === st.id).length,
  }))

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold">{sprint.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sprint.start_date ? new Date(sprint.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" }) : "-"} → {sprint.end_date ? new Date(sprint.end_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" }) : "-"}
          </p>
        </div>
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          sprint.status === "active" ? "bg-[#26d97f20] text-[#26d97f]" :
            sprint.status === "completed" ? "bg-muted text-muted-foreground" :
              "bg-[#5e6ad220] text-[#5e6ad2]"
        )}>
          {sprint.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-muted/30 p-2.5 text-center">
          <p className="text-[18px] font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">Issues</p>
        </div>
        <div className="rounded-md bg-muted/30 p-2.5 text-center">
          <p className="text-[18px] font-bold">{pts}</p>
          <p className="text-[10px] text-muted-foreground">Story Pts</p>
        </div>
        <div className="rounded-md bg-muted/30 p-2.5 text-center">
          <p className="text-[18px] font-bold text-[#26d97f]">{completion}%</p>
          <p className="text-[10px] text-muted-foreground">Complete</p>
        </div>
      </div>

      {sprint.status === "active" && total > 0 && doneIssues.length === total && (
        <p className="text-[11px] text-muted-foreground">
          All issues are done. Ask an admin to complete this sprint from Backlog.
        </p>
      )}

      {/* Status breakdown */}
      <div className="space-y-1.5">
        {byStatus.filter(s => s.count > 0).map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[11px] text-muted-foreground flex-1 truncate">{s.name}</span>
            <span className="text-[11px] font-medium">{s.count}</span>
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main ────────────────────────────────────────── */

export function ReportsView({
  sprints,
  issues,
  statuses,
  now,
}: {
  sprints: Sprint[]
  issues: Issue[]
  statuses: WorkflowStatus[]
  now: number
}) {
  const activeSprint = sprints.find(s => s.status === "active")
  const [selectedSprintId, setSelectedSprintId] = useState<string>(activeSprint?.id ?? sprints[0]?.id ?? "")
  const selectedSprint = sprints.find(s => s.id === selectedSprintId)

  const sprintIssues = useMemo(() =>
    issues.filter(i => i.sprint_id === selectedSprintId),
    [issues, selectedSprintId]
  )

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-[14px] font-medium mb-1">No sprints yet</p>
        <p className="text-[12px] text-muted-foreground">Create and start a sprint to see reports here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Reports</h2>
        <select
          value={selectedSprintId}
          onChange={e => setSelectedSprintId(e.target.value)}
          className="text-[12px] bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {sprints.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-[13px] font-semibold">Burndown</p>
          {selectedSprint ? (
            <BurndownChart sprint={selectedSprint} issues={sprintIssues} statuses={statuses} now={now} />
          ) : (
            <p className="text-[12px] text-muted-foreground text-center py-8">Select a sprint.</p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-[13px] font-semibold">Velocity</p>
          <VelocityChart sprints={sprints} issues={issues} statuses={statuses} />
        </div>
      </div>

      {/* Sprint summaries */}
      <div>
        <p className="text-[13px] font-semibold mb-3">Sprint Summaries</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sprints.map(sp => (
            <SprintSummary key={sp.id} sprint={sp} issues={issues} statuses={statuses} />
          ))}
        </div>
      </div>

      {/* Issue type breakdown */}
      <div className="rounded-lg border border-border p-4">
        <p className="text-[13px] font-semibold mb-3">Issue Types - {selectedSprint?.name}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["story", "bug", "task", "subtask"] as const).map(type => {
            const count = sprintIssues.filter(i => i.type === type).length
            const colors: Record<string, string> = {
              story: "#5e6ad2", bug: "#f54260", task: "#26d97f", subtask: "#6b6b6b"
            }
            return (
              <div key={type} className="rounded-md border border-border p-3 text-center">
                <p className="text-[22px] font-bold" style={{ color: colors[type] }}>{count}</p>
                <p className="text-[11px] text-muted-foreground capitalize mt-0.5">{type}s</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
