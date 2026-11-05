import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ReportsView } from "@/components/board/ReportsView"

export default async function ReportsPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [sprintsRes, issuesRes, statusesRes] = await Promise.all([
    supabase.from("sprints")
      .select("id,name,status,start_date,end_date,board_id,goal")
      .eq("board_id", boardId).order("created_at"),
    supabase.from("issues")
      .select("id,title,type,status_id,sprint_id,story_points,board_id,workflow_status:status_id(id,name,color,category)")
      .eq("board_id", boardId)
      .limit(500)
      .order("created_at"),
    supabase.from("workflow_statuses")
      .select("id,name,color,category,position,board_id")
      .eq("board_id", boardId).order("position"),
  ])

  return (
    <ReportsView
      sprints={(sprintsRes.data ?? []) as any}
      issues={(issuesRes.data ?? []) as any}
      statuses={(statusesRes.data ?? []) as any}
      now={Date.now()}
    />
  )
}
