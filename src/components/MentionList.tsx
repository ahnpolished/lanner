import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import type { Contact } from "~lib/contacts"

interface MentionListProps {
  contacts: Contact[]
  query: string
  onSelect: (contact: Contact) => void
  onClose: () => void
  position: { top: number; left: number }
  isLoading?: boolean
}

export function MentionList({ contacts, query, onSelect, onClose, position, isLoading }: MentionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5) // Limit to 5

  useEffect(() => {
    setSelectedIndex(0)
  }, [contacts, query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0 || isLoading) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex(i => (i + 1) % filtered.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
          break
        case "Enter":
        case "Tab":
          e.preventDefault()
          onSelect(filtered[selectedIndex])
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose, isLoading])

  if (!isLoading && filtered.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        top: position.top,
        left: position.left,
      }}
      className="absolute z-50 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="px-3 py-2 text-[10px] font-medium text-white/30 uppercase tracking-wider border-b border-white/5 flex items-center justify-between">
        <span>People</span>
        {isLoading && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {isLoading && filtered.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <div className="text-xs text-white/20">Searching...</div>
          </div>
        ) : (
          filtered.map((contact, i) => (
            <button
              key={contact.id}
              onClick={() => onSelect(contact)}
              disabled={isLoading}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${i === selectedIndex ? "bg-white/10" : "bg-white/5 hover:bg-white/20"
                }`}
            >
              {contact.photoUrl ? (
                <img src={contact.photoUrl} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] text-indigo-300 font-bold">
                  {contact.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{contact.name}</div>
                <div className="text-xs text-white/40 truncate">{contact.email}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  )
}
