"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type State = "loading" | "sign_in" | "joining" | "error"

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [state, setState] = useState<State>("loading")
  const [teamName, setTeamName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(true)
  // true = user arrived via Supabase invite email link (#access_token hash)
  const [isSupabaseInvite, setIsSupabaseInvite] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // 1. Validate the invite token + detect Supabase invite hash
  useEffect(() => {
    async function validate() {
      const supabase = createClient()

      const hash = window.location.hash
      const hashParams = new URLSearchParams(hash.slice(1))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")
      const hashIsInvite = hashParams.get("type") === "invite" && !!accessToken

      if (hashIsInvite && accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }

      const res = await fetch(`/api/invite?token=${token}`)
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.error === "already_used"
            ? "This invite link has already been used."
            : data.error === "expired"
              ? "This invite link has expired. Ask your admin for a new one."
              : "Invalid invite link."
        )
        setState("error")
        return
      }

      setTeamName(data.team_name ?? "your team")
      if (data.email) {
        setInviteEmail(data.email)
        setEmail(data.email)
      }

      const { data: { user }, error: userErr } = await supabase.auth.getUser()

      // Detect invite flow two ways:
      // 1. Hash was still present when page loaded (hashIsInvite)
      // 2. Supabase already cleared the hash but session user's invite_token matches
      //    this page's token — reliable even when hash arrives late or gets cleared early
      const fromSupabaseInvite =
        hashIsInvite || user?.user_metadata?.invite_token === token

      if (fromSupabaseInvite) setIsSupabaseInvite(true)

      if (fromSupabaseInvite && (userErr || !user)) {
        setError("This invite link is no longer valid — the account it was issued for has been removed. Ask your admin to send a fresh invite.")
        setState("error")
        return
      }

      if (user && !fromSupabaseInvite) {
        await joinTeam()
      } else {
        setState("sign_in")
      }
    }
    validate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function joinTeam() {
    setState("joining")
    const res = await fetch("/api/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      router.replace("/onboarding?joined=1")
    } else {
      const d = await res.json()
      setError(d.error ?? "Failed to join team")
      setState("error")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setError("")

    const supabase = createClient()
    const targetEmail = (inviteEmail || email).trim().toLowerCase()
    let authError = null

    if (isSupabaseInvite) {
      // ── Path A: came via Supabase email link ──────────────────────────
      // Session already exists from the hash. Just set their password.
      const { error } = await supabase.auth.updateUser({ password: password.trim() })
      authError = error

    } else if (isSignUp) {
      // ── Path B: create-account flow ───────────────────────────────────

      // Step 1: try signing in first — handles the case where admin re-invites
      //         someone who already has an account with a password.
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password.trim(),
      })

      if (!siErr) {
        // Existing user signed in — continue to join team
        authError = null
      } else {
        // Step 2: try sign-up — for brand-new users not yet in Supabase at all
        const { error: suErr } = await supabase.auth.signUp({
          email: targetEmail,
          password: password.trim(),
        })

        if (!suErr) {
          authError = null
        } else if (suErr.message?.toLowerCase().includes("already registered")) {
          // ── Path B3: Supabase invite created the user but they have no password ──
          // Use the server-side admin API to set the password safely.
          const spRes = await fetch("/api/invite/set-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password: password.trim() }),
          })
          const spData = await spRes.json()

          if (spData.existing) {
            // This email has a real confirmed account — don't override its password.
            setError(
              "This email already has an account. Switch to 'Sign in' and use your existing password."
            )
            setIsSignUp(false)
            setLoading(false)
            return
          }

          if (spData.notFound) {
            // Supabase said "already registered" but we can't find the user.
            // Shouldn't happen, but fall back to a clear error.
            setError("Account setup error — please contact your admin.")
            setLoading(false)
            return
          }

          if (!spRes.ok) {
            setError(spData.error ?? "Failed to set up account. Please try again.")
            setLoading(false)
            return
          }

          // Password set server-side — now sign in to get a session
          const { error: finalErr } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password.trim(),
          })
          authError = finalErr
        } else {
          authError = suErr
        }
      }

    } else {
      // ── Path C: sign-in mode ──────────────────────────────────────────
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password.trim(),
      })
      authError = error
    }

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    await joinTeam()
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[340px]">

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

        {state === "loading" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Validating invite...</p>
          </div>
        )}

        {state === "error" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" stroke="#f54260" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M7 5.5v3M7 10v.5" stroke="#f54260" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[13px] font-medium mb-1">Invite invalid</p>
            <p className="text-[12px] text-muted-foreground">{error}</p>
          </div>
        )}

        {state === "joining" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Joining {teamName}...</p>
          </div>
        )}

        {state === "sign_in" && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">Invite</p>
              <h1 className="text-[15px] font-semibold">Join {teamName}</h1>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {inviteEmail
                  ? `Invited as ${inviteEmail}.`
                  : isSignUp
                    ? "Create an account to accept this invite."
                    : "Sign in to accept this invite."}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {!inviteEmail && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Your email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="h-9 text-[13px] bg-secondary border-border"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  {isSupabaseInvite ? "Set your password" : "Password"}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={!!inviteEmail}
                  minLength={6}
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>

              {error && (
                <p className="text-[12px] text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full h-9 text-[13px]" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : isSupabaseInvite
                    ? "Set password & join →"
                    : isSignUp
                      ? "Create account & join →"
                      : "Sign in & join →"}
              </Button>

              {!isSupabaseInvite && (
                <p className="text-[11px] text-muted-foreground text-center mt-4">
                  {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setError("") }}
                    className="text-primary hover:underline"
                  >
                    {isSignUp ? "Sign in" : "Sign up"}
                  </button>
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
