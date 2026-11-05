import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { todayISO, getInitials, formatTime } from "@/lib/utils"
import { hourIST } from "@/lib/date"
import { StatusDot } from "@/components/dashboard/StatusBadge"
import { TeamDailyStatusTable } from "@/components/dashboard/TeamDailyStatusTable"
import { HistoryViewer } from "@/components/dashboard/HistoryViewer"
import { IssueTypeIcon } from "@/components/board/IssueTypeBadge"
import type { Profile, Checkin, EODUpdate, Project, Issue, Sprint } from "@/types/database"

/* ── Quick action card ───────────────────────────── */
function ActionCard({
  href, icon, title, subtitle, accent = false,
}: {
  href: string; icon: React.ReactNode; title: string; subtitle: string; accent?: boolean
}) {
  return (
    <Link href={href}>
      <div className={`group border rounded-lg p-3.5 cursor-pointer transition-all flex items-center gap-3 ${accent
          ? "bg-primary/5 border-primary/25 hover:bg-primary/10 hover:border-primary/40"
          : "bg-card border-border hover:bg-secondary/60 hover:border-border/80"
        }`}>
        <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 transition-colors ${accent ? "bg-primary/15 group-hover:bg-primary/20" : "bg-secondary group-hover:bg-muted"
          }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-tight ${accent ? "text-primary" : ""}`}>{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        <svg className={`shrink-0 ${accent ? "text-primary/40" : "text-muted-foreground/30"}`} width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  )
}

/* ── Sprint progress bar ─────────────────────────── */
function SprintBar({ sprint, issues }: { sprint: Sprint; issues: Issue[] }) {
  const sprintIssues = issues.filter(i => i.sprint_id === sprint.id)
  const total = sprintIssues.length
  const done = sprintIssues.filter(i => (i as any).workflow_status?.category === "done").length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const now = Date.now()
  const end = sprint.end_date ? new Date(sprint.end_date).getTime() : null
  const daysLeft = end ? Math.ceil((end - now) / 86400000) : null
  const isOverdue = daysLeft !== null && daysLeft < 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium truncate flex-1 mr-3">{sprint.name}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-muted-foreground">{done}/{total} done</span>
          {daysLeft !== null && (
            <span className={`font-medium ${isOverdue ? "text-red-400" : daysLeft <= 2 ? "text-amber-400" : "text-muted-foreground"}`}>
              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#26d97f" : "#5e6ad2" }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct}% complete</p>
    </div>
  )
}

/* ── My issues list ──────────────────────────────── */
function MyIssueRow({ issue }: { issue: Issue }) {
  const ws = (issue as any).workflow_status
  const now = Date.now()
  const isOverdue = issue.due_date && new Date(issue.due_date).getTime() < now && ws?.category !== "done"

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: "#f54260", high: "#f5a524", medium: "#5e6ad2", low: "#26d97f", no_priority: "#6b6b6b",
  }

  const isSubtask = issue.type === "subtask"

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0 hover:bg-secondary/20 -mx-4 px-4 transition-colors">
      {/* Priority dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: PRIORITY_COLORS[issue.priority] ?? "#6b6b6b" }}
      />
      {/* Type icon */}
      <IssueTypeIcon type={issue.type as any} size={13} />
      {/* Title — indent subtasks slightly */}
      <span className={`text-[13px] flex-1 truncate ${isSubtask ? "text-muted-foreground" : ""}`}>
        {isSubtask && <span className="text-[10px] text-muted-foreground/50 mr-1">↳</span>}
        {issue.title}
      </span>
      {/* Status badge */}
      {ws && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded shrink-0 hidden sm:block"
          style={{ color: ws.color, backgroundColor: ws.color + "18" }}
        >
          {ws.name}
        </span>
      )}
      {/* Due date */}
      {issue.due_date && (
        <span className={`text-[11px] shrink-0 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
          {new Date(issue.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" })}
          {isOverdue && " (overdue)"}
        </span>
      )}
    </div>
  )
}

/* ── Main ─────────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, teams(*)")
    .eq("id", user.id)
    .single() as { data: (Profile & { teams: { id: string; name: string } }) | null }

  if (!profile) return null

  const today = todayISO()
  const teamId = profile.team_id!
  const isAdmin = profile.role === "admin"
  const firstName = profile.name.split(" ")[0]
  const hour = hourIST()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  // My checkin + EOD
  const [{ data: myCheckin }, { data: myEod }] = await Promise.all([
    supabase.from("checkins").select("*, projects(*)").eq("user_id", user.id).eq("checkin_date", today).maybeSingle(),
    supabase.from("eod_updates").select("*").eq("user_id", user.id).eq("eod_date", today).maybeSingle(),
  ])

  // My assigned issues (active sprint only) — include subtasks
  const { data: myIssues } = await supabase
    .from("issues")
    .select("id, title, type, priority, status_id, due_date, sprint_id, parent_id, workflow_status:status_id(name, color, category)")
    .eq("assignee_id", user.id)
    .not("sprint_id", "is", null)
    .order("priority")
    .limit(10)

  // Active sprints (for sprint progress bar)
  const { data: boards } = await supabase.from("boards").select("id, name").eq("team_id", teamId).limit(5)
  const boardIds = (boards ?? []).map(b => b.id)

  let activeSprints: Sprint[] = []
  let sprintIssues: Issue[] = []

  if (boardIds.length > 0) {
    const [{ data: sprints }, { data: sIssues }] = await Promise.all([
      supabase.from("sprints").select("*").in("board_id", boardIds).eq("status", "active").order("created_at"),
      supabase.from("issues")
        .select("id, sprint_id, status_id, story_points, due_date, workflow_status:status_id(category)")
        .in("board_id", boardIds)
        .not("sprint_id", "is", null),
    ])
    activeSprints = sprints ?? []
    sprintIssues = (sIssues ?? []) as any
  }

  // Today's leaves - fetch alongside the member names so the banner works for everyone
  const [{ data: todayLeaves }, { data: allTeamMembers }] = await Promise.all([
    supabase.from("leaves").select("profile_id, leave_type").eq("team_id", teamId).eq("leave_date", today),
    supabase.from("profiles").select("id, name, avatar_color").eq("team_id", teamId).eq("is_active", true).order("name"),
  ])

  // Admin extras
  let teamMembers: Profile[] = []
  let allCheckins: Checkin[] = []
  let allEods: EODUpdate[] = []
  let atRiskProjects: Project[] = []
  let dailyStatusTickets: Record<string, { key: string; number: number; title: string }> = {}

  if (isAdmin) {
    const [{ data: members }, { data: checkins }, { data: eods }, { data: projects }] = await Promise.all([
      supabase.from("profiles").select("*").eq("team_id", teamId).eq("is_active", true).order("name"),
      supabase.from("checkins").select("*").eq("team_id", teamId).eq("checkin_date", today),
      supabase.from("eod_updates").select("*").eq("team_id", teamId).eq("eod_date", today),
      supabase.from("projects").select("*").eq("team_id", teamId).eq("is_active", true).neq("status", "done"),
    ])
    // Exclude the admin themselves from the daily status table - admins don't do check-ins
    teamMembers = (members ?? []).filter(m => m.id !== user.id)
    allCheckins = checkins ?? []
    allEods = eods ?? []

    const tagIds = new Set<string>()
    for (const c of allCheckins as any[]) for (const t of (c.tagged_issues ?? [])) if (t?.issue_id) tagIds.add(t.issue_id)
    for (const e of allEods as any[]) for (const t of (e.tagged_issues ?? [])) if (t?.issue_id) tagIds.add(t.issue_id)
    if (tagIds.size > 0) {
      const { data: tIssues } = await supabase
        .from("issues")
        .select("id, issue_number, title, board:board_id(key)")
        .in("id", [...tagIds])
      for (const i of (tIssues ?? []) as any[]) {
        dailyStatusTickets[i.id] = { key: i.board?.key ?? "ISSUE", number: i.issue_number, title: i.title }
      }
    }

    const now = Date.now()
    atRiskProjects = (projects ?? []).filter((p: Project) => {
      if (!p.end_date) return false
      const daysLeft = Math.ceil((new Date(p.end_date).getTime() - now) / 86400000)
      return daysLeft < 0 || daysLeft <= 3
    }).sort((a: Project, b: Project) => {
      const aDay = a.end_date ? new Date(a.end_date).getTime() : 0
      const bDay = b.end_date ? new Date(b.end_date).getTime() : 0
      return aDay - bDay
    })
  }

  const checkinDone = !!myCheckin
  const eodDone = !!myEod
  const activeSprintsForMe = activeSprints.filter(s =>
    (sprintIssues as any[]).some(i => i.sprint_id === s.id && i.assignee_id === user.id)
  )
  // Fall back to all active sprints if none assigned to me
  const sprintsToShow = activeSprintsForMe.length > 0 ? activeSprintsForMe : activeSprints.slice(0, 3)

  return (
    <div className="h-full overflow-y-auto p-5 md:p-6 lg:p-8">
    <div className="max-w-4xl space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[15px] font-semibold">{greeting}, {firstName}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" })}
          </p>
        </div>
        {/* Checkin status pill - members only */}
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${checkinDone ? "bg-[#26d97f]/10 border-[#26d97f]/25 text-[#26d97f]" : "bg-secondary border-border text-muted-foreground"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${checkinDone ? "bg-[#26d97f]" : "bg-muted-foreground/40"}`} />
              {checkinDone ? "Checked in" : "No check-in"}
            </span>
            {checkinDone && (
              <span className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${eodDone ? "bg-[#26d97f]/10 border-[#26d97f]/25 text-[#26d97f]" : "bg-secondary border-border text-muted-foreground"
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${eodDone ? "bg-[#26d97f]" : "bg-muted-foreground/40"}`} />
                {eodDone ? "EOD done" : "EOD pending"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {isAdmin ? (
          /* Admin first card: sprint health */
          <ActionCard
            href={boards?.[0] ? `/dashboard/board/${boards[0].id}/board` : "/dashboard/board"}
            accent
            title="Sprint overview"
            subtitle={activeSprints.length > 0 ? `${activeSprints.length} active sprint${activeSprints.length > 1 ? "s" : ""}` : "No active sprints"}
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="#5e6ad2" strokeWidth="1.3" />
                <path d="M1 7h14" stroke="#5e6ad2" strokeWidth="1.3" />
                <path d="M5 1v3M11 1v3" stroke="#5e6ad2" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          />
        ) : !checkinDone ? (
          <ActionCard
            href="/dashboard/checkin"
            accent
            title="Start your day"
            subtitle="Submit morning check-in"
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" stroke="#5e6ad2" strokeWidth="1.3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="#5e6ad2" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          />
        ) : !eodDone ? (
          <ActionCard
            href="/dashboard/eod"
            accent
            title="Wrap up your day"
            subtitle="Submit end-of-day update"
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M13 8.5A5.5 5.5 0 0 1 7.5 3a5.5 5.5 0 1 0 5.5 5.5Z" stroke="#5e6ad2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        ) : (
          <ActionCard
            href="/dashboard/checkin"
            title="Day complete"
            subtitle={`EOD: ${(myEod as EODUpdate).status} · ${formatTime((myEod as EODUpdate).submitted_at)}`}
            icon={
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 5" stroke="#26d97f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        )}

        <ActionCard
          href={boards?.[0] ? `/dashboard/board/${boards[0].id}/board` : "/dashboard/board"}
          title="Open board"
          subtitle={boards?.[0]?.name ?? "View issues"}
          icon={
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="1.5" width="4" height="12" rx="1" fill="currentColor" opacity="0.6" />
              <rect x="7" y="1.5" width="4" height="8" rx="1" fill="currentColor" opacity="0.4" />
            </svg>
          }
        />

        <ActionCard
          href="/dashboard/team"
          title="Team"
          subtitle={`${teamMembers.length > 0 ? teamMembers.length : ""} member${teamMembers.length !== 1 ? "s" : ""}`}
          icon={
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1 12.5a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M10.5 7.5a3 3 0 0 1 3.5 2.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/* ── My open issues (dev focus) ──────────────────────────────────── */}
      {(myIssues ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Assigned to me · {(myIssues ?? []).filter(i => (i as any).workflow_status?.category !== "done").length} open
            </p>
            {boards?.[0] && (
              <Link href={`/dashboard/board/${boards[0].id}/backlog`} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                View all →
              </Link>
            )}
          </div>
          <div className="px-4 py-1">
            {(myIssues ?? [])
              .filter(i => (i as any).workflow_status?.category !== "done")
              .slice(0, 6)
              .map(issue => (
                <MyIssueRow key={issue.id} issue={issue as unknown as Issue} />
              ))}
          </div>
        </div>
      )}

      {/* ── Sprint progress ─────────────────────────────────────────────── */}
      {sprintsToShow.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-4">Active sprints</p>
          <div className="space-y-4">
            {sprintsToShow.map(sprint => (
              <SprintBar key={sprint.id} sprint={sprint} issues={sprintIssues as Issue[]} />
            ))}
          </div>
        </div>
      )}

      {/* ── Today's check-in (if done) ──────────────────────────────────── */}
      {myCheckin && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Your plan today</p>
            <Link href="/dashboard/checkin" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Edit
            </Link>
          </div>
          <ul className="space-y-1.5">
            {(myCheckin as Checkin).todos.split("\n").filter(Boolean).map((t, i) => (
              <li key={i} className="text-[13px] flex items-start gap-2">
                <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                {t.trim()}
              </li>
            ))}
          </ul>
          {(myCheckin as Checkin).blockers && (
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-1.5">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 mt-0.5">
                <path d="M6 1L11 10H1L6 1Z" stroke="#f5a524" strokeWidth="1" strokeLinejoin="round" />
                <path d="M6 5v2M6 8.5v.5" stroke="#f5a524" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <p className="text-[12px] text-[#f5a524]">{(myCheckin as Checkin).blockers}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Who's out today ──────────────────────────────────────────────── */}
      {(todayLeaves ?? []).length > 0 && (() => {
        const leaveNames = (todayLeaves ?? []).map(l => {
          const p = (allTeamMembers ?? []).find((m: { id: string; name: string }) => m.id === l.profile_id)
          return p ? `${p.name}${l.leave_type === "half" ? " (½)" : ""}` : null
        }).filter(Boolean)
        if (leaveNames.length === 0) return null
        return (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 text-[12.5px]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-amber-400 shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.75" fill="currentColor" />
            </svg>
            <span className="text-foreground/90">
              <span className="font-medium">Out today: </span>{leaveNames.join(", ")}
            </span>
          </div>
        )
      })()}

      {/* ── ADMIN: Team daily status table ──────────────────────────────── */}
      {isAdmin && (
        <>
          {/* At-risk projects */}
          {atRiskProjects.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-red-500/15">
                <p className="text-[11px] font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                    <path d="M6 5v2M6 8.5v.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  Projects at risk · {atRiskProjects.length}
                </p>
              </div>
              <div className="divide-y divide-red-500/10">
                {atRiskProjects.map(p => {
                  const now = Date.now()
                  const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now) / 86400000) : null
                  const isOverdue = daysLeft !== null && daysLeft < 0
                  return (
                    <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-[13px] font-medium flex-1">{p.name}</span>
                      <span className={`text-[11px] font-medium ${isOverdue ? "text-red-400" : "text-amber-400"}`}>
                        {isOverdue ? `${Math.abs(daysLeft!)}d overdue` : daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Team daily status */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Team today
              </p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="text-[#26d97f] font-medium">{allCheckins.length} checked in</span>
                <span>·</span>
                <span>{teamMembers.length - allCheckins.length} pending</span>
              </div>
            </div>
            <TeamDailyStatusTable
              teamMembers={teamMembers as Profile[]}
              allCheckins={allCheckins as Checkin[]}
              allEods={allEods as EODUpdate[]}
              todayLeaves={todayLeaves ?? []}
              tickets={dailyStatusTickets}
            />
          </div>

          {/* Daily status history — browse any past day */}
          <div className="bg-card border border-border rounded-lg p-4">
            <HistoryViewer />
          </div>
        </>
      )}

    </div>
    </div>
  )
}
