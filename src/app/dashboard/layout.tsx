import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { MobileSidebarProvider } from "@/components/layout/MobileSidebarContext"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, teams(*)")
    .eq("id", user.id)
    .single()

  if (!profile?.team_id) redirect("/onboarding")
  if (!profile?.is_active) redirect("/account-disabled")

  return (
    <MobileSidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar profile={profile} />
          <main className="app-main-canvas flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  )
}
