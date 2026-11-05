"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  issue_id: string | null
  board_id: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  assigned:         "👤",
  unassigned:       "👤",
  mention:          "@",
  comment:          "💬",
  due_today:        "⚠️",
  due_tomorrow:     "📅",
  sprint_started:   "🚀",
  sprint_completed: "✅",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const dropRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioUnlockedRef = useRef(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const { notifications: data, unreadCount: count } = await res.json()
      setNotifications(data)
      setUnreadCount(count)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // Supabase realtime — instant badge update
  useEffect(() => {
    function unlockAudio() {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) return

      const context = audioContextRef.current ?? new AudioContextConstructor()
      audioContextRef.current = context
      void context.resume().then(() => {
        audioUnlockedRef.current = context.state === "running"
      }).catch(error => {
        console.warn("[notifications] Could not enable notification audio:", error)
      })
    }

    function playMentionSound() {
      const context = audioContextRef.current
      if (!audioUnlockedRef.current || !context || context.state !== "running") return

      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.21)
    }

    window.addEventListener("pointerdown", unlockAudio)
    window.addEventListener("keydown", unlockAudio)

    const supabase = createClient()
    const channel = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications(prev => [newNotif, ...prev].slice(0, 30))
          setUnreadCount(c => c + 1)
          if (newNotif.type === "mention") playMentionSound()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener("mousedown", onOutside), 50)
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onOutside) }
  }, [open])

  async function markRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    })
  }

  async function handleClick(notif: Notification) {
    if (!notif.read) markRead(notif.id)
    setOpen(false)
    if (notif.issue_id && notif.board_id) {
      router.push(`/dashboard/board/${notif.board_id}/backlog?issue=${notif.issue_id}`)
    }
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative w-7 h-7 flex items-center justify-center rounded-md transition-colors",
          open ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
        title="Notifications"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M8 2a5 5 0 00-5 5v2.5L2 11h12l-1-1.5V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-[340px] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <p className="text-[12px] font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[12px] text-muted-foreground">You&apos;re all caught up 🎉</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-secondary/50 transition-colors border-b border-border/40 last:border-0",
                    !notif.read && "bg-primary/[0.03]"
                  )}
                >
                  <span className="text-[14px] shrink-0 mt-0.5">
                    {TYPE_ICONS[notif.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[12px] leading-snug",
                      !notif.read ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{notif.body}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {!notif.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
