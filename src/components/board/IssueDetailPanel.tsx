"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn, getInitials } from "@/lib/utils"
import { toast } from "sonner"
import { IssueTypeIcon, PriorityIcon, PRIORITY_CONFIG, TYPE_CONFIG } from "./IssueTypeBadge"
import { MentionTextarea } from "@/components/ui/MentionTextarea"
import { RichTextEditor, RichTextContent } from "@/components/ui/RichTextEditor"
import type { Issue, IssueComment, IssueAttachment, WorkflowStatus, IssuePriority, IssueType } from "@/types/database"

type Member = { id: string; name: string; avatar_color: string }

export function IssueDetailPanel({
  issue: initialIssue,
  parentIssue,
  statuses,
  members,
  onClose,
  onUpdate,
  onDelete,
  isAdmin,
  currentUserId,
}: {
  issue: Issue
  parentIssue?: Issue
  statuses: WorkflowStatus[]
  members: Member[]
  onClose: () => void
  onUpdate: (updated: Issue) => void
  onDelete?: (id: string) => void
  isAdmin?: boolean
  currentUserId?: string
}) {
  const [issue, setIssue] = useState(initialIssue)
  const [comments, setComments] = useState<IssueComment[]>([])
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const [subtasks, setSubtasks] = useState<Issue[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [nestedIssue, setNestedIssue] = useState<Issue | null>(null)
  const [newComment, setNewComment] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(issue.title)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(issue.description ?? "")
  const [uploadingFile, setUploadingFile] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pointsDraft, setPointsDraft] = useState<string>(issue.story_points != null ? String(issue.story_points) : "")
  const [deletingIssue, setDeletingIssue] = useState(false)
  const [cloningIssue, setCloningIssue] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  // Parent linking
  const [localParentIssue, setLocalParentIssue] = useState<Issue | null>(parentIssue ?? null)
  const [showParentPicker, setShowParentPicker] = useState(false)
  const [parentSearch, setParentSearch] = useState("")
  const [parentOptions, setParentOptions] = useState<Issue[]>([])
  const [loadingParents, setLoadingParents] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const parentSearchRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) return
      onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  // Close on click outside the panel (skip when a nested subtask panel is open)
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (nestedIssue) return
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const t = setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 50)
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", onOutside, true) }
  }, [onClose, nestedIssue])

  useEffect(() => {
    fetch(`/api/issues/comments?issueId=${issue.id}`)
      .then(r => r.json()).then(setComments).catch(() => { })
    fetch(`/api/issues/attachments?issueId=${issue.id}`)
      .then(r => r.json()).then(setAttachments).catch(() => { })
    fetch(`/api/issues?parentId=${issue.id}`)
      .then(r => r.json()).then(data => setSubtasks(Array.isArray(data) ? data : [])).catch(() => { })

    if (issue.type === "subtask" && issue.parent_id) {
      if (parentIssue?.id === issue.parent_id) {
        setLocalParentIssue(parentIssue)
      } else {
        fetch(`/api/issues?id=${issue.parent_id}`)
          .then(r => r.json())
          .then(data => { if (data?.id) setLocalParentIssue(data) })
          .catch(() => { })
      }
    } else {
      setLocalParentIssue(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id])

  const uploadFile = useCallback(async (file: File): Promise<IssueAttachment | null> => {
    if (uploadingFile) return null
    setUploadingFile(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("issueId", issue.id)
      const res = await fetch("/api/issues/attachments", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAttachments(prev => [...prev, data])
      toast.success("File attached")
      return data as IssueAttachment
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
      return null
    } finally { setUploadingFile(false) }
  }, [issue.id, uploadingFile])

  async function deleteAttachment(id: string) {
    const res = await fetch(`/api/issues/attachments?id=${id}`, { method: "DELETE" })
    if (res.ok) setAttachments(prev => prev.filter(a => a.id !== id))
    else toast.error("Failed to delete attachment")
  }

  async function deleteIssue() {
    setDeletingIssue(true)
    try {
      const res = await fetch(`/api/issues?id=${issue.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success("Issue deleted")
      onDelete?.(issue.id)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete issue")
      setDeletingIssue(false)
    }
  }

  async function cloneIssue() {
    setCloningIssue(true)
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: issue.board_id,
          title: `Copy of ${issue.title}`,
          type: issue.type,
          description: issue.description ?? null,
          status_id: issue.status_id ?? null,
          priority: issue.priority,
          assignee_id: issue.assignee_id ?? null,
          parent_id: issue.parent_id ?? null,
          sprint_id: issue.sprint_id ?? null,
          story_points: issue.story_points ?? null,
          start_date: issue.start_date ?? null,
          due_date: issue.due_date ?? null,
          labels: issue.labels ?? [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to clone")
      toast.success(`Cloned as #${data.issue_number}`, {
        description: data.title,
        action: {
          label: "Open",
          onClick: () => window.open(`/dashboard/issue/${data.id}`, "_self"),
        },
        duration: 6000,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clone issue")
    } finally {
      setCloningIssue(false)
    }
  }

  async function deleteComment(id: string) {
    setDeletingCommentId(id)
    try {
      const res = await fetch(`/api/issues/comments?id=${id}`, { method: "DELETE" })
      if (res.ok) setComments(prev => prev.filter(c => c.id !== id))
      else { const d = await res.json(); toast.error(d.error ?? "Failed to delete comment") }
    } finally { setDeletingCommentId(null) }
  }

  async function patchIssue(updates: Partial<Issue>) {
    const res = await fetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: issue.id, ...updates }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error); return }
    setIssue(data)
    onUpdate(data)
  }

  async function saveTitle() {
    if (titleDraft.trim() && titleDraft !== issue.title) await patchIssue({ title: titleDraft.trim() })
    setEditingTitle(false)
  }

  async function saveDesc() {
    // Treat empty rich-text (e.g. "<p></p>") as no description
    const stripped = descDraft.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim()
    await patchIssue({ description: stripped ? descDraft : null })
    setEditingDesc(false)
  }

  async function createSubtask(e: React.FormEvent) {
    e.preventDefault()
    if (!newSubtaskTitle.trim()) return
    setAddingSubtask(true)
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: issue.board_id,
          title: newSubtaskTitle.trim(),
          type: "subtask",
          priority: issue.priority,
          parent_id: issue.id,
          sprint_id: issue.sprint_id ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create subtask")
      setSubtasks(prev => [...prev, data])
      setNewSubtaskTitle("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create subtask")
    } finally {
      setAddingSubtask(false)
    }
  }

  async function deleteSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id))
    const res = await fetch(`/api/issues?id=${id}`, { method: "DELETE" })
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? "Failed to delete subtask")
      setSubtasks(prev => [...prev])
    }
  }

  async function loadParentOptions(query: string) {
    setLoadingParents(true)
    try {
      const res = await fetch(`/api/issues?boardId=${issue.board_id}`)
      const data = await res.json()
      const all: Issue[] = Array.isArray(data) ? data : (data.issues ?? [])
      const filtered = all.filter(i =>
        i.id !== issue.id &&
        i.type !== "subtask" &&
        (!query || i.title.toLowerCase().includes(query.toLowerCase()) || String(i.issue_number).includes(query))
      )
      setParentOptions(filtered.slice(0, 20))
    } catch { /* ignore */ }
    finally { setLoadingParents(false) }
  }

  async function linkParent(parent: Issue) {
    setShowParentPicker(false)
    setParentSearch("")
    const prev = { issueState: issue, parent: localParentIssue }
    setLocalParentIssue(parent)
    setIssue(i => ({ ...i, parent_id: parent.id, type: "subtask" as IssueType }))
    const res = await fetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: issue.id, parent_id: parent.id, type: "subtask" }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Failed to link parent")
      setLocalParentIssue(prev.parent)
      setIssue(prev.issueState)
    } else {
      setIssue(data)
      onUpdate(data)
      toast.success("Linked to parent")
    }
  }

  async function convertToTask() {
    const prev = { issueState: issue, parent: localParentIssue }
    setLocalParentIssue(null)
    setIssue(i => ({ ...i, parent_id: null, type: "task" as IssueType }))
    const res = await fetch("/api/issues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: issue.id, parent_id: null, type: "task" }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? "Failed to convert")
      setLocalParentIssue(prev.parent)
      setIssue(prev.issueState)
    } else {
      setIssue(data)
      onUpdate(data)
      toast.success("Converted to task")
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setPostingComment(true)
    const res = await fetch("/api/issues/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue_id: issue.id, content: newComment.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setComments(c => [...c, data.comment])
      setNewComment("")
      if (data.notificationWarning) {
        toast.warning("Comment posted, but one or more notifications could not be delivered.")
      }
    } else {
      toast.error(data.error)
    }
    setPostingComment(false)
  }

  const boardKey = issue.board?.key ?? "ISSUE"
  const canDelete = isAdmin || issue.reporter_id === currentUserId

  return (
    <>
    <div
      ref={panelRef}
      className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-background border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <IssueTypeIcon type={issue.type} size={16} />
            <span className="text-[11px] font-mono text-muted-foreground">{boardKey}-{issue.issue_number}</span>
            {issue.type === "subtask" && localParentIssue && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 1v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="truncate max-w-[180px]" title={localParentIssue.title}>
                  {boardKey}-{localParentIssue.issue_number} {localParentIssue.title}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Copy shareable link */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/dashboard/issue/${issue.id}`
                navigator.clipboard.writeText(url).then(() => {
                  toast.success("Link copied!", {
                    description: "Paste it anywhere - Teams, Slack…",
                    duration: 3000,
                  })
                })
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Copy link"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            {/* Clone issue */}
            <button
              onClick={cloneIssue}
              disabled={cloningIssue}
              title="Clone issue"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
            >
              {cloningIssue ? (
                <span className="text-[10px]">…</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              )}
            </button>

            {canDelete && (
              <button
                onClick={() =>
                  toast.warning("Delete this issue?", {
                    description: "This cannot be undone.",
                    action: { label: "Delete", onClick: deleteIssue },
                    duration: 8000,
                  })
                }
                disabled={deletingIssue}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                title="Delete issue"
              >
                {deletingIssue ? (
                  <span className="text-[10px]">…</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Title */}
            {editingTitle ? (
              <input
                ref={titleRef}
                className="w-full text-[16px] font-semibold bg-transparent border-b border-primary outline-none pb-1"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false) }}
                autoFocus
              />
            ) : (
              <h2
                className="text-[16px] font-semibold cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setEditingTitle(true); setTitleDraft(issue.title) }}
              >
                {issue.title}
              </h2>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
              <MetaRow label="Status">
                <select
                  value={issue.status_id ?? ""}
                  onChange={e => patchIssue({ status_id: e.target.value || null })}
                  className="bg-transparent border-none outline-none text-[12px] text-foreground cursor-pointer"
                >
                  {statuses.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </MetaRow>

              <MetaRow label="Priority">
                <select
                  value={issue.priority}
                  onChange={e => patchIssue({ priority: e.target.value as IssuePriority })}
                  className="bg-transparent border-none outline-none text-[12px] text-foreground cursor-pointer"
                >
                  {(Object.keys(PRIORITY_CONFIG) as IssuePriority[]).map(p => (
                    <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                  ))}
                </select>
              </MetaRow>

              <MetaRow label="Type">
                {issue.type === "subtask" ? (
                  <span className="text-[12px] text-muted-foreground capitalize">Subtask</span>
                ) : (
                  <select
                    value={issue.type}
                    onChange={e => patchIssue({ type: e.target.value as IssueType })}
                    className="bg-transparent border-none outline-none text-[12px] text-foreground cursor-pointer"
                  >
                    {(Object.keys(TYPE_CONFIG) as IssueType[]).filter(t => t !== "subtask").map(t => (
                      <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                )}
              </MetaRow>

              <MetaRow label="Assignee">
                <select
                  value={issue.assignee_id ?? ""}
                  onChange={e => patchIssue({ assignee_id: e.target.value || null })}
                  className="bg-transparent border-none outline-none text-[12px] text-foreground cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </MetaRow>

              <MetaRow label="Story points">
                <input
                  type="number" min="0" step="0.5"
                  value={pointsDraft}
                  onChange={e => setPointsDraft(e.target.value)}
                  onBlur={() => {
                    const val = pointsDraft.trim()
                    const parsed = val ? parseFloat(val) : null
                    if (parsed !== (issue.story_points ?? null)) {
                      patchIssue({ story_points: parsed })
                    }
                  }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  className="bg-transparent border-none outline-none text-[12px] w-16"
                  placeholder="-"
                />
              </MetaRow>

              <MetaRow label="Due date">
                <input
                  type="date"
                  value={issue.due_date ?? ""}
                  onChange={e => patchIssue({ due_date: e.target.value || null })}
                  className="bg-transparent border-none outline-none text-[12px] dark:[color-scheme:dark] cursor-pointer"
                />
              </MetaRow>
            </div>

            {/* Parent row */}
            <div className="text-[12px] flex items-start gap-2">
              <span className="text-muted-foreground/70 w-24 shrink-0 pt-0.5">Parent</span>
              <div className="flex-1 min-w-0">
                {issue.type === "subtask" && localParentIssue ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md truncate max-w-[240px]" title={localParentIssue.title}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
                        <path d="M2 1v6a1 1 0 001 1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      {issue.board?.key ?? "ISSUE"}-{localParentIssue.issue_number} {localParentIssue.title}
                    </span>
                    <button
                      onClick={convertToTask}
                      className="text-[11px] text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      title="Remove parent and convert to standalone task"
                    >
                      Convert to task
                    </button>
                  </div>
                ) : issue.type !== "subtask" ? (
                  <div className="relative">
                    {showParentPicker ? (
                      <div className="space-y-1">
                        <input
                          ref={parentSearchRef}
                          value={parentSearch}
                          onChange={e => {
                            setParentSearch(e.target.value)
                            loadParentOptions(e.target.value)
                          }}
                          onKeyDown={e => { if (e.key === "Escape") { setShowParentPicker(false); setParentSearch("") } }}
                          placeholder="Search issues…"
                          autoFocus
                          className="w-full text-[12px] bg-secondary border border-border rounded-md px-2.5 py-1 outline-none focus:ring-1 focus:ring-primary"
                        />
                        {loadingParents && (
                          <p className="text-[11px] text-muted-foreground px-1">Searching…</p>
                        )}
                        {!loadingParents && parentOptions.length === 0 && parentSearch && (
                          <p className="text-[11px] text-muted-foreground px-1">No issues found</p>
                        )}
                        {parentOptions.length > 0 && (
                          <div className="bg-card border border-border rounded-md shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
                            {parentOptions.map(opt => (
                              <button
                                key={opt.id}
                                onMouseDown={e => { e.preventDefault(); linkParent(opt) }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-secondary transition-colors"
                              >
                                <IssueTypeIcon type={opt.type} size={12} />
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                  {issue.board?.key ?? "ISSUE"}-{opt.issue_number}
                                </span>
                                <span className="text-[12px] truncate">{opt.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => { setShowParentPicker(false); setParentSearch("") }}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowParentPicker(true); loadParentOptions("") }}
                        className="text-[12px] text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                        Add parent
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground/40 text-[12px]">—</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Description</p>
              {editingDesc ? (
                <div className="space-y-2">
                  <RichTextEditor
                    value={descDraft}
                    onChange={setDescDraft}
                    placeholder="Add a description…"
                    minHeight={120}
                    autoFocus
                    onImageUpload={async (file) => { const a = await uploadFile(file); return a?.file_url ?? null }}
                  />
                  <div className="flex gap-2">
                    <button onClick={saveDesc}
                      className="text-[12px] px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                      Save
                    </button>
                    <button onClick={() => setEditingDesc(false)}
                      className="text-[12px] px-3 py-1.5 border border-border rounded-md hover:bg-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingDesc(true); setDescDraft(issue.description ?? "") }}
                  className={cn(
                    "min-h-[60px] p-3 rounded-md cursor-text hover:bg-secondary transition-colors",
                    !issue.description && "text-[13px] text-muted-foreground/50 italic"
                  )}
                >
                  {issue.description
                    ? <RichTextContent html={issue.description} />
                    : "Click to add description…"}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Attachments ({attachments.length})
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  {uploadingFile ? "Uploading…" : "Attach"}
                </button>
                <input ref={fileInputRef} type="file" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = "" }} />
              </div>

              {/* Drop zone — click anywhere on empty area to browse */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
                onClick={() => { if (!uploadingFile) fileInputRef.current?.click() }}
                className={cn(
                  "rounded-md border-2 border-dashed p-3 transition-colors cursor-pointer",
                  dragOver ? "border-primary bg-primary/5" : "border-border/50 hover:border-border",
                  attachments.length === 0 && "min-h-[60px] flex items-center justify-center"
                )}
              >
                {attachments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50">
                    {dragOver ? "Drop to upload" : uploadingFile ? "Uploading…" : "Drop files here or click to browse"}
                  </p>
                )}
                {attachments.length > 0 && (
                  <div className="grid grid-cols-2 gap-2" onClick={e => e.stopPropagation()}>
                    {attachments.map(a => <AttachmentCard key={a.id} attachment={a} onDelete={() => deleteAttachment(a.id)} />)}
                  </div>
                )}
              </div>
            </div>

            {/* Subtasks */}
            {issue.type !== "subtask" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground/60">
                        {subtasks.filter(s => (s as any).workflow_status?.category === "done" || (s as any).status_id === statuses.find(st => st.category === "done")?.id).length}/{subtasks.length}
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {subtasks.map(sub => {
                    const subStatus = statuses.find(st => st.id === sub.status_id)
                    const isDone = subStatus?.category === "done"
                    return (
                      <div key={sub.id}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-secondary/50 group cursor-pointer transition-colors"
                        onClick={() => setNestedIssue(sub)}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 border"
                          style={{
                            backgroundColor: isDone ? subStatus?.color : "transparent",
                            borderColor: subStatus?.color ?? "#6b7280"
                          }} />
                        <span className={cn("text-[12.5px] flex-1 truncate", isDone && "line-through text-muted-foreground")}>
                          {sub.title}
                        </span>
                        {subStatus && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 hidden group-hover:block"
                            style={{ color: subStatus.color, backgroundColor: subStatus.color + "18" }}>
                            {subStatus.name}
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); toast.warning("Delete subtask?", { action: { label: "Delete", onClick: () => deleteSubtask(sub.id) }, duration: 6000 }) }}
                          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                  <form onSubmit={createSubtask} className="flex items-center gap-2 px-2.5 py-1">
                    <input
                      value={newSubtaskTitle}
                      onChange={e => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add subtask…"
                      className="flex-1 text-[12.5px] bg-transparent outline-none placeholder:text-muted-foreground/40 min-w-0"
                      disabled={addingSubtask}
                    />
                    {newSubtaskTitle.trim() && (
                      <button type="submit" disabled={addingSubtask}
                        className="text-[11px] px-2 py-0.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0">
                        {addingSubtask ? "…" : "Add"}
                      </button>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Comments ({comments.length})
              </p>
              <div className="space-y-3">
                {comments.map(c => {
                  const author = c.profiles as Member | undefined
                  const canDeleteComment = isAdmin || c.user_id === currentUserId
                  return (
                    <div key={c.id} className="flex gap-2.5 group">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: author?.avatar_color ?? "#5e6ad2" }}
                      >
                        {getInitials(author?.name ?? "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-[12px] font-medium">{author?.name ?? "Unknown"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                          </span>
                          {canDeleteComment && (
                            <button
                              onClick={() =>
                                toast.warning("Delete this comment?", {
                                  action: { label: "Delete", onClick: () => deleteComment(c.id) },
                                  duration: 6000,
                                })
                              }
                              disabled={deletingCommentId === c.id}
                              className="ml-auto w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30 shrink-0"
                              title="Delete comment"
                            >
                              {deletingCommentId === c.id ? (
                                <span className="text-[9px]">…</span>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-[12.5px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {c.content.split(/(@\w+(?:\s\w+)?)/g).map((part, i) =>
                            part.startsWith("@") ? (
                              <span key={i} className="text-primary font-medium bg-primary/10 px-1 py-0.5 rounded text-[12px]">{part}</span>
                            ) : part
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* Add comment */}
                <form onSubmit={postComment} className="flex flex-col gap-2 pt-1">
                  <MentionTextarea
                    value={newComment}
                    onChange={setNewComment}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment(e as unknown as React.FormEvent) }}
                    placeholder="Add a comment… (@ to mention)"
                    members={members}
                    minHeight={72}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="submit" disabled={postingComment || !newComment.trim()}
                      className="px-3 py-1.5 text-[12px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {postingComment ? "…" : "Send"}
                    </button>
                    <span className="text-[10px] text-muted-foreground/40">⌘↵ to send</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
    </div>

    {/* Nested subtask panel */}
    {nestedIssue && (
      <IssueDetailPanel
        key={nestedIssue.id}
        issue={nestedIssue}
        parentIssue={issue}
        statuses={statuses}
        members={members}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onClose={() => setNestedIssue(null)}
        onUpdate={updated => {
          setSubtasks(prev => prev.map(s => s.id === updated.id ? updated : s))
          setNestedIssue(updated)
        }}
        onDelete={id => {
          setSubtasks(prev => prev.filter(s => s.id !== id))
          setNestedIssue(null)
        }}
      />
    )}
    </>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground/70 w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

const OpenIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M10 2h4v4M14 2l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function AttachmentCard({ attachment, onDelete }: { attachment: IssueAttachment; onDelete: () => void }) {
  const isImage = attachment.file_type?.startsWith("image/")
  const sizeKb = attachment.file_size ? Math.round(attachment.file_size / 1024) : null
  const [confirming, setConfirming] = useState(false)

  // Inline anchored confirm overlay — same for images and files
  const ConfirmOverlay = () => (
    <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-background/95 backdrop-blur-sm rounded-md border border-destructive/40 px-2">
      <span className="text-[10px] text-muted-foreground mr-0.5">Delete?</span>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="text-[10px] px-2 py-0.5 rounded bg-destructive text-white hover:bg-destructive/90 transition-colors"
      >
        Delete
      </button>
      <button
        onClick={e => { e.stopPropagation(); setConfirming(false) }}
        className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-secondary transition-colors"
      >
        Cancel
      </button>
    </div>
  )

  if (isImage) {
    return (
      <div className="relative group rounded-md overflow-hidden border border-border bg-secondary aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.file_url} alt={attachment.file_name} className="w-full h-full object-cover" />
        {confirming && <ConfirmOverlay />}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-1.5 gap-1">
          <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" title="Open"
            className="w-6 h-6 flex items-center justify-center rounded bg-white/20 hover:bg-white/35 text-white transition-colors">
            <OpenIcon />
          </a>
          <button onClick={() => setConfirming(true)} title="Delete"
            className="w-6 h-6 flex items-center justify-center rounded bg-white/20 hover:bg-destructive/80 text-white transition-colors">
            <TrashIcon />
          </button>
        </div>
        <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white/80 px-1.5 py-1 bg-black/40 truncate">
          {attachment.file_name}
        </p>
      </div>
    )
  }

  const ext = attachment.file_name.split(".").pop()?.toUpperCase() ?? "FILE"
  return (
    <div className="relative flex items-center gap-2 p-2 rounded-md border border-border bg-secondary group">
      {confirming && <ConfirmOverlay />}
      <div className="w-8 h-8 rounded bg-card border border-border flex items-center justify-center shrink-0">
        <span className="text-[8px] font-bold text-muted-foreground">{ext}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate">{attachment.file_name}</p>
        {sizeKb && <p className="text-[10px] text-muted-foreground">{sizeKb}KB</p>}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" title="Open file"
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
          <OpenIcon />
        </a>
        <button onClick={() => setConfirming(true)} title="Delete"
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
