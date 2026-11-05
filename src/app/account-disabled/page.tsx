"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AccountDisabledPage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[340px]">
        {/* Logo */}
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

        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.3" className="text-muted-foreground" />
              <path d="M6 9h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-muted-foreground" />
            </svg>
          </div>

          <div>
            <p className="text-[14px] font-semibold">Account deactivated</p>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
              Your account has been deactivated by your workspace admin.
              Contact them if you think this is a mistake.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full h-9 text-[13px] font-medium rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
