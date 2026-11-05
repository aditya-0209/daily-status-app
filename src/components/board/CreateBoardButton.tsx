"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function CreateBoardButton() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newKey, setNewKey] = useState("")

  async function createBoard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim() || !newKey.trim()) return

    setCreating(true)
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), key: newKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create board")

      toast.success("Board created")
      router.push(`/dashboard/board/${data.id}/backlog`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create board")
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCreate(true)}
        className="h-9 px-4 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Create board
      </button>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-[14px] font-semibold mb-4">Create board</h2>
            <form onSubmit={createBoard} className="space-y-3">
              <div>
                <label htmlFor="first-board-name" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Board name
                </label>
                <input
                  id="first-board-name"
                  className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Product"
                  value={newName}
                  onChange={e => {
                    setNewName(e.target.value)
                    if (!newKey) setNewKey(e.target.value.slice(0, 6).toUpperCase().replace(/\s/g, ""))
                  }}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="first-board-key" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Board key
                </label>
                <input
                  id="first-board-key"
                  className="w-full h-9 px-3 text-[13px] bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  placeholder="e.g. PROD"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                  maxLength={8}
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                  className="flex-1 h-9 text-[13px] border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim() || !newKey.trim()}
                  className="flex-1 h-9 text-[13px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
