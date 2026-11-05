"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Step = "loading" | "choose" | "create_workspace" | "enter_code" | "done"

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justJoined = searchParams.get("joined") === "1"

  const [step, setStep] = useState<Step>("loading")
  const [teamName, setTeamName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id, name")
        .eq("id", user.id)
        .single()

      setUserEmail(user.email ?? "")

      // If just joined via /join/[token], just collect name then go
      if (justJoined && profile?.team_id) {
        const defaultName = user.email?.split("@")[0] ?? ""
        setUserName(profile.name === defaultName ? "" : profile.name ?? "")
        setStep("done")
        return
      }

      // Already has team - go to dashboard
      if (profile?.team_id) { router.replace("/dashboard/board"); return }

      const defaultName = user.email?.split("@")[0] ?? ""
      setUserName(profile?.name === defaultName ? "" : profile?.name ?? "")
      setStep("choose")
    }
    init()
  }, [router, justJoined])

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    setLoading(true)
    setError("")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({ name: teamName.trim() })
        .select()
        .single()
      if (teamErr) throw teamErr

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          team_id: team.id,
          role: "admin",
          ...(userName.trim() ? { name: userName.trim() } : {}),
        })
        .eq("id", user.id)
      if (profileErr) throw profileErr

      router.replace("/dashboard/board")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault()
    const code = inviteCode.trim()
    if (!code) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "already_used") throw new Error("This invite code has already been used.")
        if (data.error === "expired") throw new Error("This invite code has expired. Ask your admin for a new one.")
        if (data.error === "invalid_token") throw new Error("Invalid code. Check with your admin.")
        throw new Error(data.error ?? "Failed to join")
      }

      if (userName.trim()) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await supabase.from("profiles").update({ name: userName.trim() }).eq("id", user.id)
      }

      router.replace("/dashboard/board")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    if (!userName.trim()) { router.replace("/dashboard/board"); return }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from("profiles").update({ name: userName.trim() }).eq("id", user.id)
      router.replace("/dashboard/board")
    } finally {
      setLoading(false)
    }
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="white" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="white" opacity="0.5" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="white" opacity="0.5" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="white" opacity="0.25" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Daily Status</span>
        </div>

        {/* Choose path */}
        {step === "choose" && (
          <div className="space-y-3">
            <div className="mb-6">
              <h1 className="text-[17px] font-semibold">
                Welcome{userEmail ? `, ${userEmail.split("@")[0]}` : ""}
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1">How would you like to get started?</p>
            </div>

            <button
              onClick={() => setStep("create_workspace")}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:bg-secondary/60 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="7" width="12" height="7.5" rx="1.5" stroke="#5e6ad2" strokeWidth="1.3" />
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#5e6ad2" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-primary">Create a workspace</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    You&apos;re the admin - set up your team, add projects, invite devs.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep("enter_code")}
              className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-border/80 hover:bg-secondary/60 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary group-hover:bg-muted flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M13 8H3m0 0 4-4M3 8l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold">Join a team</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Have an invite code from your admin? Paste it here.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Create workspace */}
        {step === "create_workspace" && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <button
              onClick={() => { setStep("choose"); setError("") }}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <h1 className="text-[15px] font-semibold mb-0.5">Create your workspace</h1>
            <p className="text-[13px] text-muted-foreground mb-5">You&apos;ll be the admin. Invite your team after.</p>

            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Your name
                </label>
                <Input
                  placeholder="Aditya"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoFocus
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Workspace name
                </label>
                <Input
                  placeholder="Amazon, Acme Corp..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>
              {error && (
                <p className="text-[12px] text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full h-9 text-[13px]" disabled={loading || !teamName.trim()}>
                {loading ? "Creating..." : "Create workspace →"}
              </Button>
            </form>
          </div>
        )}

        {/* Enter invite code */}
        {step === "enter_code" && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <button
              onClick={() => { setStep("choose"); setError("") }}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M7.5 2.5 4 6l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <h1 className="text-[15px] font-semibold mb-0.5">Join your team</h1>
            <p className="text-[13px] text-muted-foreground mb-5">
              Paste the invite code or full invite link your admin shared.
            </p>

            <form onSubmit={handleJoinWithCode} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Your name
                </label>
                <Input
                  placeholder="Rahul"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoFocus
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Invite code
                </label>
                <Input
                  placeholder="Paste code or full link..."
                  value={inviteCode}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    const match = v.match(/\/join\/([a-f0-9]+)/)
                    setInviteCode(match ? match[1] : v)
                    setError("")
                  }}
                  required
                  className="h-9 text-[13px] bg-secondary border-border font-mono"
                />
              </div>
              {error && (
                <p className="text-[12px] text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full h-9 text-[13px]" disabled={loading || !inviteCode.trim()}>
                {loading ? "Joining..." : "Join team →"}
              </Button>
            </form>
          </div>
        )}

        {/* Finish - after joining via link */}
        {step === "done" && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#26d97f]/10 flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3.5 9.5l4 4 7-8" stroke="#26d97f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-[15px] font-semibold mb-0.5">You&apos;re in!</h1>
            <p className="text-[13px] text-muted-foreground mb-5">One last thing - what should we call you?</p>
            <form onSubmit={handleFinish} className="space-y-3">
              <Input
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                autoFocus
                className="h-9 text-[13px] bg-secondary border-border"
              />
              <Button type="submit" className="w-full h-9 text-[13px]" disabled={loading}>
                {loading ? "Saving..." : "Go to dashboard →"}
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  )
}
