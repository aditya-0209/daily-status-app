"use client"

import { useState, useEffect } from "react"
import { useMobileSidebar } from "./MobileSidebarContext"
import { NotificationBell } from "./NotificationBell"
import { SearchPalette } from "./SearchPalette"
import { fmtDateFull } from "@/lib/date"
import type { Profile } from "@/types/database"

export function TopBar({ profile }: { profile: Profile | null }) {
  const isAdmin = profile?.role === "admin"
  const { toggle } = useMobileSidebar()
  const [searchOpen, setSearchOpen] = useState(false)

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <header className="app-topbar h-12 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          {/* Hamburger - mobile only */}
          <button
            onClick={toggle}
            className="md:hidden flex flex-col gap-[4px] w-5 h-5 items-center justify-center shrink-0"
            aria-label="Open menu"
          >
            <span className="w-4 h-[1.5px] bg-foreground/70 rounded-full" />
            <span className="w-4 h-[1.5px] bg-foreground/70 rounded-full" />
            <span className="w-3 h-[1.5px] bg-foreground/70 rounded-full self-start" />
          </button>

          <p className="text-[12px] text-muted-foreground hidden sm:block">
            {fmtDateFull()}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 h-7 px-3 min-w-[140px] text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors border border-border/60"
            title="Search (⌘K)"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-left text-[12px]">Search</span>
            <kbd className="text-[9px] text-muted-foreground/40 border border-border rounded px-1 py-0.5 leading-tight shrink-0">⌘K</kbd>
          </button>

          {/* Notification bell */}
          {profile?.id && (
            <NotificationBell userId={profile.id} />
          )}

          {isAdmin && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-1">
              Admin
            </span>
          )}
        </div>
      </header>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
