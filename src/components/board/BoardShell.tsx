"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { BoardSettings } from "./BoardSettings"
import type { Board, Profile, WorkflowStatus } from "@/types/database"

const TABS = [
  { key: "summary",      label: "Summary"      },
  { key: "board",        label: "Board"        },
  { key: "backlog",      label: "Backlog"      },
  { key: "timeline",     label: "Timeline"     },
  { key: "reports",      label: "Reports"      },
  { key: "releases",     label: "Releases"     },
  { key: "availability", label: "Availability" },
]

export function BoardShell({
  boards,
  activeBoardId,
  profile,
  statuses,
  children,
}: {
  boards: Board[]
  activeBoardId?: string
  profile: Profile
  statuses?: WorkflowStatus[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = profile.role === "admin"
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newKey, setNewKey] = useState("")

  const lastSegment = pathname.split("/").pop() ?? ""
  const activeTab = TABS.find(t => t.key === lastSegment)?.key ?? "backlog"
  const activeBoard = boards.find(b => b.id === activeBoardId)

  // Cache boardId in a cookie so /dashboard/board redirects instantly on next visit
  useEffect(() => {
    if (activeBoardId) {
      document.cookie = `last_board=${activeBoardId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    }
  }, [activeBoardId])

  async function createBoard(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newKey.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), key: newKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Board created")
      setShowCreate(false)
      setNewName(""); setNewKey("")
      router.push(`/dashboard/board/${data.id}/backlog`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="board-workspace flex flex-col h-full overflow-hidden">
      {/* Board header */}
      <div className="board-header border-b border-border bg-background shrink-0">
        {/* Top bar: board selector + create */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-0">
          {boards.map(b => (
            <Link
              key={b.id}
              href={`/dashboard/board/${b.id}/backlog`}
              className={cn(
                "text-[12px] font-semibold px-3 py-1.5 border transition-colors",
                activeBoardId === b.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {b.name}
            </Link>
          ))}
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors flex items-center gap-1 ml-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              New board
            </button>
          )}
        </div>

        {/* Tab nav + settings gear */}
        {activeBoardId && (
          <div className="flex items-center px-4 mt-2">
            {TABS.map(tab => (
              <Link
                key={tab.key}
                href={`/dashboard/board/${activeBoardId}/${tab.key}`}
                className={cn(
                  "text-[12px] px-3 py-2.5 border-b-2 transition-colors -mb-px whitespace-nowrap uppercase tracking-wide",
                  activeTab === tab.key
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            ))}

            {/* Spacer + gear */}
            <div className="ml-auto flex items-center pb-1">
              {activeBoard && isAdmin && (
                <BoardSettings
                  board={activeBoard}
                  statuses={statuses ?? []}
                  isAdmin={isAdmin}
                  onBoardUpdated={() => router.refresh()}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-auto px-5 pt-5 pb-4 md:px-6 md:pt-6 md:pb-4">
        {children}
      </div>

      {/* Create board modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-[14px] font-semibold mb-4">Create board</h2>
            <form onSubmit={createBoard} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Board name</label>
                <input
                  className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Amazon, Design"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); if (!newKey) setNewKey(e.target.value.slice(0,6).toUpperCase().replace(/\s/g,"")) }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Board key</label>
                <input
                  className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  placeholder="e.g. UPLVYL"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8))}
                  maxLength={8}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 h-9 text-[13px] border border-border rounded-md hover:bg-secondary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim() || !newKey.trim()}
                  className="flex-1 h-9 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {creating ? "Creating…" : "Create →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
