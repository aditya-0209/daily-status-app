export type Role = "member" | "admin"
export type IssueType = "epic" | "story" | "bug" | "task" | "subtask"
export type IssuePriority = "urgent" | "high" | "medium" | "low" | "no_priority"
export type SprintStatus = "planning" | "active" | "completed"
export type ReleaseStatus = "unreleased" | "released" | "archived"
export type WorkflowCategory = "todo" | "in_progress" | "done"
export type EODStatus = "done" | "partial" | "blocked"
export type InsightType = "blocker" | "reminder" | "risk" | "kudos" | "suggestion"
export type ProjectStatus = "backlog" | "active" | "qa" | "staging" | "production" | "on_hold" | "done"
export type ProjectPriority = "low" | "medium" | "high" | "critical"
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked"
export type TaskPriority = "low" | "medium" | "high"
export type Availability = "working" | "half_day" | "remote"
export type LeaveType = "full" | "half"

export interface Team {
  id: string
  name: string
  timezone: string
  created_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  avatar_color: string
  team_id: string | null
  team_name?: string | null
  role_name?: string | null
  is_active: boolean
  created_at: string
  teams?: Team
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string | null
  end_date: string | null
  team_id: string
  is_active: boolean
  completed_at: string | null
  completion_notes: string | null
  created_at: string
  milestones?: Milestone[]
  tasks?: Task[]
}

export interface Milestone {
  id: string
  project_id: string
  team_id: string
  title: string
  is_done: boolean
  done_at: string | null
  sort_order: number
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  team_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Leave {
  id: string
  profile_id: string
  team_id: string
  leave_date: string
  leave_type: LeaveType
  reason: string | null
  marked_by: string | null
  created_at: string
  profiles?: Profile
}

export interface Holiday {
  id: string
  team_id: string
  name: string
  holiday_date: string
  created_at: string
}

export interface Invite {
  id: string
  team_id: string
  email: string | null
  invited_by: string | null
  token: string
  used_at: string | null
  expires_at: string
  created_at: string
  teams?: Team
}

export interface Checkin {
  id: string
  user_id: string
  team_id: string
  project_id: string | null
  todos: string
  blockers: string | null
  availability: Availability
  risk: boolean
  risk_note: string | null
  checkin_date: string
  submitted_at: string
  profiles?: Profile
  projects?: Project
}

export interface QualityGate {
  matches_prd: boolean
  dev_qa: boolean
  needs_review: boolean
  review_what_whom: string | null
}

export interface EODUpdate {
  id: string
  user_id: string
  team_id: string
  checkin_id: string | null
  accomplished: string
  pending: string | null
  status: EODStatus
  completion_pct: number | null
  confidence: "high" | "medium" | "low" | null
  risk: boolean
  risk_note: string | null
  quality_gate: QualityGate | null
  eod_date: string
  submitted_at: string
  profiles?: Profile
}

export interface DailySummary {
  id: string
  team_id: string
  summary_date: string
  summary_text: string
  insights: Insight[] | null
  generated_at: string
  share_token: string | null
}

export interface Insight {
  type: InsightType
  title: string
  detail: string
}

export interface MemberStatus {
  profile: Profile
  checkin: Checkin | null
  eod: EODUpdate | null
  leave: Leave | null
}

export interface Board {
  id: string
  team_id: string
  name: string
  key: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface WorkflowStatus {
  id: string
  board_id: string
  team_id: string
  name: string
  color: string
  category: WorkflowCategory
  position: number
  created_at: string
}

export interface Sprint {
  id: string
  board_id: string
  team_id: string
  name: string
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Issue {
  id: string
  board_id: string
  team_id: string
  issue_number: number
  type: IssueType
  title: string
  description: string | null
  status_id: string | null
  priority: IssuePriority
  assignee_id: string | null
  reporter_id: string | null
  parent_id: string | null
  sprint_id: string | null
  story_points: number | null
  start_date: string | null
  due_date: string | null
  rank: string
  labels: string[]
  created_at: string
  updated_at: string
  // joined
  workflow_status?: WorkflowStatus
  assignee?: Profile
  reporter?: Profile
  subtasks?: Issue[]
  board?: Board
}

export interface IssueComment {
  id: string
  issue_id: string
  user_id: string | null
  team_id: string
  content: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface IssueAttachment {
  id: string
  issue_id: string
  user_id: string | null
  team_id: string
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  created_at: string
}

export interface Release {
  id: string
  board_id: string
  team_id: string
  name: string
  version: string | null
  description: string | null
  status: ReleaseStatus
  release_date: string | null
  created_at: string
}

export interface DocFolder {
  id: string
  team_id: string
  parent_id: string | null
  name: string
  created_by: string | null
  created_at: string
}

export interface DocLink {
  id: string
  team_id: string
  folder_id: string | null
  title: string
  url: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  creator?: { id: string; name: string; avatar_color: string }
}

export interface SummaryQA {
  id: string
  team_id: string
  summary_date: string
  question: string
  answer: string
  asked_by: string | null
  created_at: string
}
