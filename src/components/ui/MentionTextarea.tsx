"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

type Member = { id: string; name: string; avatar_color: string }

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  members,
  disabled,
  autoFocus,
  minHeight = 72,
  textareaRef: externalRef,
  onImagePaste,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  className?: string
  members: Member[]
  disabled?: boolean
  autoFocus?: boolean
  minHeight?: number
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  // Returns the uploaded URL to insert into the text, or null to skip
  onImagePaste?: (file: File) => Promise<string | null>
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [pickerIdx, setPickerIdx] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = externalRef ?? internalRef
  const pickerRef = useRef<HTMLDivElement>(null)

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? value.length
    const newVal = value.slice(0, cursor) + text + value.slice(cursor)
    onChange(newVal)
    setTimeout(() => {
      if (el) {
        const pos = cursor + text.length
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!onImagePaste) return
    const items = Array.from(e.clipboardData?.items ?? [])
    const imageItem = items.find(it => it.type.startsWith("image/"))
    if (!imageItem) return // let normal text/link paste happen
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    const url = await onImagePaste(file)
    if (url) insertAtCursor(`${value && !value.endsWith("\n") ? "\n" : ""}${url}\n`)
  }

  const filteredMembers = members.filter(m =>
    !pickerQuery || m.name.toLowerCase().startsWith(pickerQuery.toLowerCase())
  ).slice(0, 6)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length

    // Detect @ trigger
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@([\w\s]*)$/)

    if (atMatch) {
      setMentionStart(textBefore.lastIndexOf("@"))
      setPickerQuery(atMatch[1])
      setPickerIdx(0)
      setShowPicker(true)
    } else {
      setShowPicker(false)
      setMentionStart(-1)
    }

    onChange(val)
  }

  function insertMention(member: Member) {
    if (mentionStart === -1) return
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + pickerQuery.length)
    const newVal = `${before}@${member.name}${after.startsWith(" ") ? "" : " "}${after}`
    onChange(newVal)
    setShowPicker(false)
    setMentionStart(-1)
    // Restore focus + set cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + 1 + member.name.length + 1
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showPicker && e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      setShowPicker(false)
      return
    }

    if (showPicker && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setPickerIdx(i => Math.min(i + 1, filteredMembers.length - 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setPickerIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(filteredMembers[pickerIdx])
        return
      }
    }
    onKeyDown?.(e)
  }

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    function onOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [showPicker])

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          "w-full text-[12.5px] bg-secondary border border-border rounded-md p-2.5 resize-none outline-none focus:ring-1 focus:ring-primary",
          className
        )}
        style={{ minHeight }}
      />

      {/* Mention picker */}
      {showPicker && filteredMembers.length > 0 && (
        <div
          ref={pickerRef}
          onMouseDown={e => e.stopPropagation()}
          className="absolute bottom-full mb-1 left-0 w-52 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-100"
        >
          {filteredMembers.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={e => { e.preventDefault(); insertMention(m) }}
              onMouseEnter={() => setPickerIdx(i)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors",
                pickerIdx === i ? "bg-primary/10" : "hover:bg-secondary"
              )}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                style={{ backgroundColor: m.avatar_color ?? "#5e6ad2" }}
              >
                {getInitials(m.name)}
              </div>
              <span className="text-[12.5px]">{m.name}</span>
            </button>
          ))}
          <div className="px-3 py-1 border-t border-border">
            <p className="text-[9px] text-muted-foreground/40">↑↓ navigate · ↵ select · Esc cancel</p>
          </div>
        </div>
      )}
    </div>
  )
}
