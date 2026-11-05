import { createServiceClient } from "@/lib/supabase/server"

export type NotifType =
  | "assigned"
  | "unassigned"
  | "mention"
  | "comment"
  | "due_today"
  | "due_tomorrow"
  | "sprint_started"
  | "sprint_completed"

export async function insertNotification({
  userId,
  type,
  title,
  body,
  issueId,
  boardId,
}: {
  userId: string
  type: NotifType
  title: string
  body?: string
  issueId?: string
  boardId?: string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      issue_id: issueId ?? null,
      board_id: boardId ?? null,
    })
  } catch {
    // Notifications are fire-and-forget — never break the main flow
  }
}

/** Insert the same notification for multiple users at once */
export async function insertNotifications(
  rows: {
    userId: string
    type: NotifType
    title: string
    body?: string
    issueId?: string
    boardId?: string
  }[]
) : Promise<boolean> {
  if (rows.length === 0) return true
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from("notifications").insert(
      rows.map(r => ({
        user_id: r.userId,
        type: r.type,
        title: r.title,
        body: r.body ?? null,
        issue_id: r.issueId ?? null,
        board_id: r.boardId ?? null,
      }))
    )
    if (error) {
      console.error("[notifications] Failed to insert notifications:", error)
      return false
    }
    return true
  } catch (error) {
    console.error("[notifications] Failed to insert notifications:", error)
    return false
  }
}
