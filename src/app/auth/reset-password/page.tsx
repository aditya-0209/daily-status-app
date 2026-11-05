"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type State = "loading" | "ready" | "success" | "error"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<State>("loading")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [errorDetail, setErrorDetail] = useState("")

  useEffect(() => {
    if (searchParams.get("error") === "link_invalid") {
      setErrorDetail("This link was opened in a different browser than where you requested the reset. Please request a new reset link and open it in the same browser.")
      setState("error")
      return
    }

    async function init() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setErrorDetail("This reset link has expired or is invalid. Please request a new one.")
        setState("error")
        return
      }

      setState("ready")
    }
    init()
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }

    setLoading(true)
    setError("")

    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({
      password: password.trim(),
    })

    if (updateErr) {
      setError(updateErr.message)
      setLoading(false)
      return
    }

    setState("success")
    setTimeout(() => router.replace("/dashboard/board"), 2000)
  }

  // ── Logo ─────────────────────────────────────────────────────────────
  const Logo = () => (
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
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[340px]">
        <Logo />

        {/* Loading */}
        {state === "loading" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-muted-foreground">Verifying link...</p>
          </div>
        )}

        {/* Invalid / expired link */}
        {state === "error" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" stroke="#f54260" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M7 5.5v3M7 10v.5" stroke="#f54260" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-medium">Link invalid</p>
              <p className="text-[12px] text-muted-foreground mt-1">{errorDetail}</p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="text-[12px] text-primary hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* Set new password form */}
        {state === "ready" && (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h1 className="text-[15px] font-semibold mb-0.5">Set new password</h1>
            <p className="text-[13px] text-muted-foreground mb-5">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  New password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Confirm password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="h-9 text-[13px] bg-secondary border-border"
                />
              </div>

              {error && (
                <p className="text-[12px] text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-9 text-[13px] font-medium mt-2"
                disabled={loading}
              >
                {loading ? "Saving..." : "Set password →"}
              </Button>
            </form>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#26d97f]/15 flex items-center justify-center mx-auto">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9.5l4 4 8-8" stroke="#26d97f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold">Password updated</p>
              <p className="text-[12px] text-muted-foreground mt-1">Taking you to your dashboard…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
