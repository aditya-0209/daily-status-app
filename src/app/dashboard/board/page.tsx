import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { CreateBoardButton } from "@/components/board/CreateBoardButton"

export default async function BoardIndexPage() {
  // Fast path: if user has visited a board before, redirect instantly via cookie
  const cookieStore = await cookies()
  const lastBoard = cookieStore.get("last_board")?.value
  if (lastBoard) redirect(`/dashboard/board/${lastBoard}/backlog`)

  // Slow path (first ever visit): fetch from DB
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("team_id, role").eq("id", user.id).single()
  if (!profile?.team_id) redirect("/onboarding")

  const { data: boards, error } = await supabase
    .from("boards")
    .select("id")
    .eq("team_id", profile.team_id)
    .order("created_at")
    .limit(1)

  if (error) {
    // boards table likely not set up yet - send to a safe empty state
    console.error("[board/page] boards query error:", error.message)
  }

  if (boards && boards.length > 0) {
    redirect(`/dashboard/board/${boards[0].id}/backlog`)
  }

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <h2 className="text-[15px] font-semibold mb-1">No boards yet</h2>
      <p className="text-[13px] text-muted-foreground mb-3">
        {error
          ? "Database not set up - run schema-v5.sql in Supabase SQL Editor first."
          : profile.role === "admin"
            ? "Create a board to get your team started."
            : "Ask your admin to create a board to get started."}
      </p>
      {!error && profile.role === "admin" && <CreateBoardButton />}
    </div>
  )
}
