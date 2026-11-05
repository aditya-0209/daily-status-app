"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { getInitials } from "@/lib/utils"
import { StatusDot } from "@/components/dashboard/StatusBadge"
import { DailyStatusDetail } from "@/components/dashboard/DailyStatusDetail"
import type { Profile, Checkin, EODUpdate } from "@/types/database"

type Leave = { profile_id: string; leave_type: string }
type TicketMap = Record<string, { key: string; number: number; title: string }>

const EOD_STATUS_CONFIG = {
  done:    { label: "Done",    color: "#26d97f" },
  partial: { label: "Partial", color: "#f5a524" },
  blocked: { label: "Blocked", color: "#f54260" },
}

/* ── per-member status card inside the panel ── */
function MemberDailyStatusCard({
  member,
  checkin,
  eod,
  leave,
  tickets,
}: {
  member: Profile
  checkin: Checkin | undefined
  eod: EODUpdate | undefined
  leave: { leave_type: string } | undefined
  tickets?: TicketMap
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-secondary/30 border-b border-border">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
          style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
        >
          {getInitials(member.name)}
        </div>
        <p className="text-[13px] font-semibold flex-1">{member.name}</p>
        <div className="flex items-center gap-1.5">
          {leave && (
            <span className="text-[10px] text-amber-400 capitalize">{leave.leave_type} day</span>
          )}
          {checkin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#26d97f]/10 text-[#26d97f] border border-[#26d97f]/20">
              SOD ✓
            </span>
          )}
          {eod && (() => {
            const cfg = EOD_STATUS_CONFIG[eod.status as keyof typeof EOD_STATUS_CONFIG]
            return cfg ? (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border"
                style={{ color: cfg.color, backgroundColor: cfg.color + "15", borderColor: cfg.color + "30" }}
              >
                EOD · {cfg.label}
              </span>
            ) : null
          })()}
        </div>
      </div>

      <DailyStatusDetail sod={checkin} eod={eod} tickets={tickets} />
    </div>
  )
}

/* ── main export ── */
export function TeamDailyStatusTable({
  teamMembers,
  allCheckins,
  allEods,
  todayLeaves,
  tickets,
}: {
  teamMembers: Profile[]
  allCheckins: Checkin[]
  allEods: EODUpdate[]
  todayLeaves: Leave[]
  tickets?: TicketMap
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const anyDetail = teamMembers.some(m =>
    allCheckins.find(c => c.user_id === m.id) || allEods.find(e => e.user_id === m.id)
  )

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    const t = setTimeout(() => document.addEventListener("mousedown", onOutside), 50)
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onOutside) }
  }, [panelOpen])

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setPanelOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [panelOpen])

  return (
    <>
      {/* Avatar strip */}
      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
        {teamMembers.map(member => {
          const checkin = allCheckins.find(c => c.user_id === member.id)
          const onLeave = todayLeaves.some(l => l.profile_id === member.id)
          return (
            <div
              key={member.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-border/50"
              title={`${member.name}: ${onLeave ? "on leave" : checkin ? "checked in" : "no check-in"}`}
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white shrink-0"
                style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
              >
                {getInitials(member.name)}
              </div>
              <span className="text-[11px] font-medium">{member.name.split(" ")[0]}</span>
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={checkin && !onLeave
                  ? { backgroundColor: "#26d97f" }
                  : onLeave
                    ? { backgroundColor: "#f5a524" }
                    : { backgroundColor: "#6b7280" }
                }
              />
            </div>
          )
        })}
      </div>

      {/* Table */}
      <table className="w-full mt-1">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Member</th>
            <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">SOD</th>
            <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider">EOD</th>
            <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:table-cell">Blocker</th>
            <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:table-cell">Availability</th>
            <th className="px-4 py-2 text-right">
              {anyDetail && (
                <button
                  onClick={() => setPanelOpen(true)}
                  className="text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  View all →
                </button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {teamMembers.map(member => {
            const checkin = allCheckins.find(c => c.user_id === member.id)
            const eod = allEods.find(e => e.user_id === member.id)
            const leave = todayLeaves.find(l => l.profile_id === member.id)
            return (
              <tr key={member.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: member.avatar_color ?? "#5e6ad2" }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <p className="text-[13px]">{member.name}</p>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusDot status={checkin ? "sod" : "none"} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusDot status={(eod?.status as "done" | "partial" | "blocked") ?? "none"} />
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {checkin?.blockers
                    ? <span className="text-[11px] font-medium text-amber-400">Yes</span>
                    : <span className="text-[11px] text-muted-foreground/40">—</span>
                  }
                </td>
                <td className="px-4 py-2.5 hidden sm:table-cell">
                  {leave ? (
                    <span className="text-[11px] text-amber-400 capitalize">{leave.leave_type} day leave</span>
                  ) : (
                    <span className="text-[11px] text-[#26d97f]">Available</span>
                  )}
                </td>
                <td />
              </tr>
            )
          })}
          {teamMembers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                No members yet.{" "}
                <Link href="/admin/members" className="text-primary hover:underline">Invite your team →</Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Right slide-in panel — no backdrop, content stays visible */}
      {panelOpen && (
        <div
          ref={panelRef}
          className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0">
            <div className="flex items-center text-[14px] font-semibold">
  <span>Team daily status</span>

  <span className="mx-2 w-1.5 h-1.5 rounded-full bg-gray-400"></span>

  <span className="text-[11px] text-muted-foreground font-normal">
    {allCheckins.length} of {teamMembers.length} checked in today
  </span>
</div>
            <button
              onClick={() => setPanelOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Scrollable list of member cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {teamMembers.map(member => (
              <MemberDailyStatusCard
                key={member.id}
                member={member}
                checkin={allCheckins.find(c => c.user_id === member.id)}
                eod={allEods.find(e => e.user_id === member.id)}
                leave={todayLeaves.find(l => l.profile_id === member.id)}
                tickets={tickets}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
