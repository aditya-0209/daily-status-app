"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { cn, getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useMobileSidebar } from "./MobileSidebarContext"
import type { Profile } from "@/types/database"

// ── Icons ────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function DashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.2" />
    </svg>
  )
}

function BoardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="1.5" width="4" height="12" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="7" y="1.5" width="4" height="8" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="12.5" y="1.5" width="0" height="0" rx="1" fill="currentColor" opacity="0" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 12.5a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10.5 7.5a3 3 0 0 1 3.5 2.9v2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function DocsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M3 1.5h5l4 4v8a0.5 0.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 1.5v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 8h5M5 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

const NAV_MEMBER = [
  { href: "/dashboard",              label: "Overview",         icon: <DashIcon /> },
  { href: "/dashboard/board",        label: "Board",            icon: <BoardIcon /> },
  { href: "/dashboard/checkin",      label: "Morning check-in", icon: <Icon d="M8 2v3m0 6v3M2 8h3m6 0h3M4.05 4.05l2.12 2.12m3.54 3.54 2.12 2.12M4.05 11.95l2.12-2.12m3.54-3.54 2.12-2.12" /> },
  { href: "/dashboard/eod",          label: "End of day",       icon: <Icon d="M11.5 7A4.5 4.5 0 0 1 7 2.5a4.5 4.5 0 1 0 4.5 4.5Z" /> },
  { href: "/dashboard/team",         label: "Team",             icon: <TeamIcon /> },
  { href: "/dashboard/documentation", label: "Documentation",   icon: <DocsIcon /> },
]

const NAV_ADMIN = [
  { href: "/dashboard",              label: "Overview",      icon: <DashIcon /> },
  { href: "/dashboard/board",        label: "Board",         icon: <BoardIcon /> },
  { href: "/dashboard/team",         label: "Team",          icon: <TeamIcon /> },
  { href: "/dashboard/documentation", label: "Documentation", icon: <DocsIcon /> },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
      title="Toggle theme"
      suppressHydrationWarning
    >
      {!mounted ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
        </svg>
      ) : theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M13 8.5A5.5 5.5 0 0 1 7.5 3a5.5 5.5 0 1 0 5.5 5.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function ProfileDropdown({
  profile,
  collapsed,
  onSignOut,
}: {
  profile: Profile
  collapsed: boolean
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className={cn("relative border-t border-sidebar-border", collapsed ? "px-0 py-2" : "px-3 py-2.5")}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? profile.name : undefined}
        className={cn(
          "flex items-center rounded-[5px] hover:bg-sidebar-accent transition-colors w-full",
          collapsed ? "justify-center px-0 py-1" : "gap-2 px-1 py-1"
        )}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
          style={{ backgroundColor: profile.avatar_color ?? "#5e6ad2" }}
        >
          {getInitials(profile.name)}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[12px] font-medium truncate leading-tight">{profile.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">{profile.role}</p>
            </div>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={cn("text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")}
            >
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute bottom-full mb-1 bg-popover border border-border rounded-[6px] shadow-lg py-1 z-50",
          collapsed ? "left-full ml-2 w-44 bottom-2" : "left-2 right-2"
        )}>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-secondary transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1a5.3 5.3 0 0 0 .05-.7v-.6a5.3 5.3 0 0 0-.05-.7l1.5-1.2a.4.4 0 0 0 .1-.5l-1.4-2.4a.4.4 0 0 0-.5-.15l-1.8.72a5.5 5.5 0 0 0-1.2-.7L9.6 1.4A.4.4 0 0 0 9.2 1h-2.4a.4.4 0 0 0-.4.34l-.27 1.9a5.5 5.5 0 0 0-1.2.7l-1.77-.72a.4.4 0 0 0-.5.15L1.23 5.8a.39.39 0 0 0 .1.5l1.5 1.2A5.5 5.5 0 0 0 2.77 8v.6a5.3 5.3 0 0 0 .05.7l-1.5 1.2a.4.4 0 0 0-.1.5l1.4 2.4c.1.18.32.24.5.15l1.77-.72a5.5 5.5 0 0 0 1.2.7l.27 1.9c.05.2.22.34.4.34h2.4c.18 0 .35-.14.4-.34l.27-1.9a5.5 5.5 0 0 0 1.2-.7l1.77.72c.18.1.4.03.5-.15l1.4-2.4a.39.39 0 0 0-.1-.5l-1.5-1.2Z" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            Settings
          </Link>
          <div className="mx-2 my-1 border-t border-border" />
          <button
            onClick={() => { setOpen(false); onSignOut() }}
            className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-secondary transition-colors w-full text-left"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M10 8H2m0 0 3-3M2 8l3 3M6 5V3.5A1.5 1.5 0 0 1 7.5 2h5A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 6 12.5V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { open, close } = useMobileSidebar()
  const isAdmin = profile?.role === "admin"
  const navItems = isAdmin ? NAV_ADMIN : NAV_MEMBER

  const [collapsed, setCollapsed] = useState(false)

  // Persist collapse state
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored === "true") setCollapsed(true)
  }, [])

  function toggleCollapse() {
    setCollapsed(v => {
      localStorage.setItem("sidebar-collapsed", String(!v))
      return !v
    })
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={close}
        />
      )}

      <aside className={cn(
        "app-sidebar shrink-0 h-screen flex flex-col bg-sidebar",
        "fixed top-0 left-0 z-50 transition-all duration-200 ease-in-out",
        "md:relative md:translate-x-0",
        collapsed ? "w-[56px]" : "w-[248px]",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>

        {/* Logo row */}
        <div className={cn(
          "flex items-center h-11 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-0" : "gap-2 px-3"
        )}>
          {/* Logo icon — click to toggle collapse */}
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-7 h-7 bg-sidebar-primary flex items-center justify-center shrink-0 hover:opacity-75 transition-opacity"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" fill="currentColor" className="text-sidebar-primary-foreground" />
              <rect x="7" y="1" width="4" height="4" fill="currentColor" className="text-sidebar-primary-foreground" opacity="0.65" />
              <rect x="1" y="7" width="4" height="4" fill="currentColor" className="text-sidebar-primary-foreground" opacity="0.65" />
              <rect x="7" y="7" width="4" height="4" fill="currentColor" className="text-sidebar-primary-foreground" opacity="0.35" />
            </svg>
          </button>
          {!collapsed && (
            <>
              <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground flex-1">Daily Status</span>
              <ThemeToggle />
            </>
          )}
        </div>

        {/* Theme toggle row in collapsed mode */}
        {collapsed && (
          <div className="flex justify-center py-1.5 border-b border-sidebar-border">
            <ThemeToggle />
          </div>
        )}

        {/* Team name */}
        {!collapsed && profile && (
          <div className="px-4 py-2 border-b border-sidebar-border">
            <p className="text-[11px] text-muted-foreground truncate">
              {(profile as { teams?: { name: string } }).teams?.name ?? "My Workspace"}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className={cn("flex-1 py-2 space-y-0.5 overflow-y-auto", collapsed ? "px-1.5" : "px-2")}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href.length > 10 && pathname.startsWith(item.href + "/")) ||
              (item.href === "/dashboard/board" && pathname.startsWith("/dashboard/board"))
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center rounded-[5px] text-[13px] transition-colors",
                  collapsed ? "justify-center px-0 py-2" : "gap-2 px-2.5 py-[6px]",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-sidebar-foreground" : "text-muted-foreground/70")}>
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Profile dropdown */}
        {profile && (
          <ProfileDropdown
            profile={profile}
            collapsed={collapsed}
            onSignOut={signOut}
          />
        )}
      </aside>
    </>
  )
}
