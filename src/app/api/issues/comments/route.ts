import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { insertNotifications } from "@/lib/notifications"

export async function GET(req: Request) {
  const issueId = new URL(req.url).searchParams.get("issueId")
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("issue_comments")
    .select("*, profiles:user_id(id, name, avatar_color)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("team_id, name")
    .eq("id", user.id)
    .single()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.team_id) return NextResponse.json({ error: "no_team" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const issueId = body?.issue_id
  const content = body?.content
  if (typeof issueId !== "string" || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "issue_id and content required" }, { status: 400 })
  }

  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select("assignee_id, title, board_id, issue_number, board:board_id(key)")
    .eq("id", issueId)
    .eq("team_id", profile.team_id)
    .maybeSingle()
  if (issueError) return NextResponse.json({ error: issueError.message }, { status: 500 })
  if (!issue) return NextResponse.json({ error: "issue_not_found" }, { status: 404 })

  const trimmed = content.trim()
  const { data, error } = await supabase.from("issue_comments").insert({
    issue_id: issueId,
    user_id: user.id,
    team_id: profile.team_id,
    content: trimmed,
  }).select("*, profiles:user_id(id, name, avatar_color)").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const boardRelation = issue.board as { key: string } | { key: string }[] | null
  const boardKey = (Array.isArray(boardRelation) ? boardRelation[0]?.key : boardRelation?.key) ?? "ISSUE"
  const snippet = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed
  const notifs: Parameters<typeof insertNotifications>[0] = []

  if (issue.assignee_id && issue.assignee_id !== user.id) {
    notifs.push({
      userId: issue.assignee_id,
      type: "comment",
      title: `${profile.name} commented on: [${boardKey}-${issue.issue_number}] ${issue.title}`,
      body: snippet,
      issueId,
      boardId: issue.board_id,
    })
  }

  const { data: teamMembers, error: membersError } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("team_id", profile.team_id)
    .eq("is_active", true)

  let notificationWarning = !!membersError
  if (membersError) {
    console.error("[issue-comments] Failed to load team members for mentions:", membersError)
  }

  const mentionedIds = new Set<string>()
  if (!membersError) {
    const markerPattern = /(^|[^\p{L}\p{N}_])@/gu
    for (const marker of trimmed.matchAll(markerPattern)) {
      const atPosition = (marker.index ?? 0) + marker[1].length
      const followingText = trimmed.slice(atPosition + 1)
      const matches = (teamMembers ?? []).filter(member => {
        const name = member.name.trim()
        if (!name || !followingText.toLocaleLowerCase().startsWith(name.toLocaleLowerCase())) return false
        const nextCharacter = followingText.slice(name.length, name.length + 1)
        return !nextCharacter || !/[\p{L}\p{N}_]/u.test(nextCharacter)
      })
      const longestMatch = Math.max(0, ...matches.map(member => member.name.trim().length))
      for (const member of matches) {
        if (member.name.trim().length === longestMatch) mentionedIds.add(member.id)
      }
    }
  }

  for (const memberId of mentionedIds) {
    if (memberId === user.id || notifs.some(notification => notification.userId === memberId)) continue
    notifs.push({
      userId: memberId,
      type: "mention",
      title: `${profile.name} mentioned you in: [${boardKey}-${issue.issue_number}] ${issue.title}`,
      body: snippet,
      issueId,
      boardId: issue.board_id,
    })
  }

  if (!await insertNotifications(notifs)) notificationWarning = true

  return NextResponse.json({ comment: data, notificationWarning })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, content } = await req.json()
  const { data, error } = await supabase.from("issue_comments")
    .update({ content: content.trim(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id)
    .select("*, profiles:user_id(id, name, avatar_color)").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("team_id, role").eq("id", user.id).single()

  let q = supabase.from("issue_comments").delete().eq("id", id!)
  if (profile?.role !== "admin") q = q.eq("user_id", user.id)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
