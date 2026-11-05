"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Mode = "sign_in" | "sign_up" | "forgot" | "forgot_sent"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("sign_in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function switchMode(next: Mode) {
    setMode(next)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const supabase = createClient()

    if (mode === "forgot") {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password` }
      )
      if (resetErr && !resetErr.message.toLowerCase().includes("rate limit")) {
        setError(resetErr.message)
        setLoading(false)
        return
      }
      setMode("forgot_sent")
      setLoading(false)
      return
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    let authError = null

    if (mode === "sign_up") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      if (signUpError) {
        authError = signUpError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        })
        authError = signInError
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      })
      authError = error
    }

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.replace("/dashboard/board")
  }

  // ── Logo ────────────────────────────────────────────────────────────
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

  // ── Forgot sent confirmation ─────────────────────────────────────────
  if (mode === "forgot_sent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-[340px]">
          <Logo />
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1.5" y="4" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" className="text-primary" />
                <path d="M1.5 6L9 11L16.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-primary" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold">Check your email</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                If <span className="text-foreground font-medium">{email}</span> is registered,
                you&apos;ll receive a reset link shortly.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button
                onClick={() => { setMode("forgot"); setError("") }}
                className="text-primary hover:underline"
              >
                try again
              </button>
              .
            </p>
            <button
              onClick={() => switchMode("sign_in")}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────
  const isForgot = mode === "forgot"
  const isSignUp = mode === "sign_up"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[340px]">
        <Logo />
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h1 className="text-[15px] font-semibold mb-0.5">
            {isForgot ? "Reset password" : isSignUp ? "Create an account" : "Sign in"}
          </h1>
          <p className="text-[13px] text-muted-foreground mb-5">
            {isForgot
              ? "Enter your email and we'll send a reset link."
              : isSignUp
                ? "Enter your email and create a password."
                : "Enter your email and password to sign in."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                Work email
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

            {!isForgot && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-9 text-[13px] bg-secondary border-border"
                />
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors mt-1.5"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            )}

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
              {loading
                ? "Please wait..."
                : isForgot
                  ? "Send reset link →"
                  : isSignUp
                    ? "Create account →"
                    : "Sign in →"}
            </Button>

            {isForgot ? (
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                <button
                  type="button"
                  onClick={() => switchMode("sign_in")}
                  className="text-primary hover:underline"
                >
                  ← Back to sign in
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(isSignUp ? "sign_in" : "sign_up")}
                  className="text-primary hover:underline"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
