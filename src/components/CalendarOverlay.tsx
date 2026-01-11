import { useState, useEffect, useRef } from "react"
import { X, Mic, Send, Check, Loader2, RefreshCcw, Download, Sparkles, Calendar } from "lucide-react"
import { usePromptAPI } from "@ahnopologetic/use-prompt-api/react"
import { motion, AnimatePresence } from "framer-motion"

import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { createEvent, type CalendarEvent, getAuthToken } from "../lib/calendar"
import { getContacts, type Contact, searchContacts } from "../lib/contacts"
import { LannerAILogo } from "./LannerAILogo"
import { ModelDownloadStatus } from "./ModelDownloadStatus"
import { AIModelAvailability, normalizeAvailability } from "~lib/ai"
import { getUserConfig, saveUserConfig, type AIPreference } from "~lib/storage"
import { Onboarding } from "./Onboarding"
import { GoogleSignIn } from "./GoogleSignIn"
import { MentionList } from "./MentionList"

// Move schema to a constant string for the prompt
const SCHEMA_DEF = `
{
  "events": [
    {
      "title": "string",
      "start": "ISO 8601 string (e.g., 2024-01-01T10:00:00)",
      "end": "ISO 8601 string",
      "location": "string (optional)",
      "description": "string (optional)"
    }
  ]
}
`

// Utility to get caret coordinates
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div')
  const style = window.getComputedStyle(element)

  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop))
  })

  div.style.position = 'fixed'
  div.style.top = '0px'
  div.style.left = '0px'
  div.style.visibility = 'hidden'
  div.style.height = 'auto'
  div.style.width = style.width
  div.style.overflow = 'hidden'
  div.style.whiteSpace = 'pre-wrap'

  div.textContent = element.value.substring(0, position)

  const span = document.createElement('span')
  span.textContent = '.'
  div.appendChild(span)

  document.body.appendChild(div)

  const spanRect = span.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  
  // Calculate relative to the element (not viewport)
  const top = span.offsetTop - element.scrollTop
  const left = span.offsetLeft - element.scrollLeft

  document.body.removeChild(div)

  return { top, left }
}

export default function CalendarOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [generatedEvents, setGeneratedEvents] = useState<CalendarEvent[]>([])

  const [status, setStatus] = useState<"idle" | "generating" | "review" | "creating" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Onboarding & Config & Auth
  const [isOnboarding, setIsOnboarding] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // Contacts & Mentions
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mentionState, setMentionState] = useState<{
    active: boolean
    query: string
    start: number
    top: number
    left: number
  }>({ active: false, query: "", start: 0, top: 0, left: 0 })
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  const { prompt, ready, availability } = usePromptAPI({
    systemPrompt: `You are a helpful calendar assistant. 
        The current time and timezone is ${new Date().toTimeString()}.
        The current date is ${new Date().toDateString()}.
        
        INSTRUCTIONS:
        1. Extract ONE OR MORE event details from the user's request.
        2. Respond ONLY with valid JSON matching this structure:
        ${SCHEMA_DEF}
        3. Rules:
        ${"   "}- 'start' and 'end' MUST be valid ISO 8601 strings.
        ${"   "}- If no end time, assume 1 hour.
        ${"   "}- If no date, assume tomorrow.
        ${"   "}- Infer relative dates from today.
        ${"   "}- Do not add any markdown formatting (no markdown code blocks). Just the raw JSON string.
        `
  })

  const [derivedAvailability, setDerivedAvailability] = useState<AIModelAvailability>(AIModelAvailability.UNKNOWN)

  useEffect(() => {
    setDerivedAvailability(normalizeAvailability(availability))
  }, [availability])

  // Sync speech transcript to text input
  useEffect(() => {
    if (transcript) {
      setTextInput((prev) => prev ? prev + " " + transcript : transcript)
      resetTranscript()
    }
  }, [transcript, resetTranscript])

  // Check config and auth when opening
  useEffect(() => {
    if (isOpen) {
      const checkState = async () => {
        setIsCheckingAuth(true)
        const config = await getUserConfig()
        setIsOnboarding(!config.onboardingCompleted)

        // Check if we have a valid token (non-interactive first)
        try {
          await getAuthToken(false)
          setIsAuthenticated(true)
          // Fetch contacts in background
          getContacts().then(setContacts)
        } catch (e) {
          setIsAuthenticated(false)
        } finally {
          setIsCheckingAuth(false)
        }
      }
      checkState()
    }
  }, [isOpen])

  const toggleOverlay = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setGeneratedEvents([])
      setStatus("idle")
      setMentionState(prev => ({ ...prev, active: false }))
    }
  }

  const handleOnboardingComplete = async (pref: AIPreference) => {
    await saveUserConfig({ aiPreference: pref, onboardingCompleted: true })
    setIsOnboarding(false)
  }

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
    getContacts().then(setContacts)
  }

  const handleGenerate = async () => {
    if (!textInput.trim() || !ready) return
    setStatus("generating")
    setErrorMessage("")

    try {
      const rawResult = await prompt(`User Request: ${textInput}`)
      console.debug("Raw Model Output:", rawResult)

      // clean up markdown if present
      const cleanJson = rawResult.replace(/```json\n?|\n?```/g, "").trim()
      const result = JSON.parse(cleanJson) // Expected { events: [...] }

      // Validate basic structure
      if (!result.events || !Array.isArray(result.events)) {
        throw new Error("Invalid output format: expected 'events' array")
      }

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const events: CalendarEvent[] = result.events.map((evt: any) => {
        if (!evt.title || !evt.start || !evt.end) {
          throw new Error("Invalid event parameters")
        }
        return {
          summary: evt.title,
          description: evt.description,
          location: evt.location,
          start: {
            dateTime: evt.start,
            timeZone: timeZone
          },
          end: {
            dateTime: evt.end,
            timeZone: timeZone
          }
        }
      })

      setGeneratedEvents(events)
      setStatus("review")
    } catch (e) {
      console.error(e)
      setStatus("error")
      setErrorMessage("Failed to parse event. Please try again.")
    }
  }

  const handleApprove = async () => {
    if (generatedEvents.length === 0) return
    setStatus("creating")
    try {
      // Create all events in parallel
      await Promise.all(generatedEvents.map(evt => createEvent(evt)))

      setStatus("success")
      setTimeout(() => {
        setIsOpen(false)
        setTextInput("")
        setGeneratedEvents([])
        setStatus("idle")
      }, 2000)
    } catch (e: any) {
      setStatus("error")
      setErrorMessage(e.message)
    }
  }

  const handleRetry = () => {
    setGeneratedEvents([])
    setStatus("idle")
  }

  // Mention Logic
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    const newPos = e.target.selectionStart
    setTextInput(newVal)

    // Clear any pending search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    // Check for mention trigger
    // Look backwards from cursor for '@'
    const textBeforeCursor = newVal.slice(0, newPos)
    const mentionMatch = textBeforeCursor.match(/(?<=^|\s)@(\w*)$/)

    if (mentionMatch && mentionMatch.index !== undefined) {
      const query = mentionMatch[1]
      const start = mentionMatch.index
      
      // Calculate coordinates
      const coords = getCaretCoordinates(e.target, start + 1) // +1 for @
      
      setMentionState({
        active: true,
        query,
        start, // This is the index of '@'
        top: coords.top - 220, // Move up by approx dropdown height
        left: coords.left
      })

      // Debounced API search if query is long enough
      if (query.length >= 2) {
        setIsSearching(true)
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            const results = await searchContacts(query)
            if (results.length > 0) {
              setContacts(prev => {
                const combined = [...prev]
                results.forEach(r => {
                  if (!combined.some(c => c.email === r.email)) {
                    combined.push(r)
                  }
                })
                return combined
              })
            }
          } finally {
            setIsSearching(false)
          }
        }, 500) // 500ms debounce
      }
    } else {
      setMentionState(prev => ({ ...prev, active: false }))
      setIsSearching(false)
    }
  }

  const handleSelectContact = (contact: Contact) => {
    // Replace text after @ with Contact Name
    const before = textInput.slice(0, mentionState.start + 1) // Keep the @
    const after = textInput.slice(textareaRef.current?.selectionStart || textInput.length)
    const insert = `${contact.name} ` 
    
    const newText = before + insert + after
    setTextInput(newText)
    setMentionState(prev => ({ ...prev, active: false }))
    
    // Restore focus and cursor
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus()
            const newCursorPos = before.length + insert.length
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
    }, 0)
  }

  const renderMainContent = () => {
    if (isCheckingAuth) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-white/20" />
        </div>
      )
    }

    if (!isAuthenticated) {
      return (
        <motion.div
          key="auth"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <GoogleSignIn onSuccess={handleAuthSuccess} />
        </motion.div>
      )
    }

    if (derivedAvailability !== AIModelAvailability.AVAILABLE) {
      return (
        <motion.div
          key="download"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <ModelDownloadStatus availability={derivedAvailability} />
        </motion.div>
      )
    }

    if (status === "idle" || status === "generating" || status === "error") {
      return (
        <motion.div
          key="input"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="relative group">
            <textarea
              ref={textareaRef}
              className="w-full h-24 bg-transparent border-0 p-4 text-xl text-white placeholder-white/20 resize-none focus:ring-0 leading-relaxed focus:outline-none"
              placeholder="Coffee with @Ryan tomorrow at 10am..."
              style={{ fontFamily: "inherit" }}
              value={textInput}
              onChange={handleInput}
              onKeyDown={(e) => {
                // If mention list is active, we let it handle arrows/enter via its own listener?
                // Actually, since the input has focus, we need to block here if needed.
                // The MentionList component in previous step uses document listener, which works if we don't stopPropagation here.
                // But we need to prevent the cursor from moving in textarea if we are navigating the list.
                if (mentionState.active) {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault() 
                        // We need to signal MentionList to move. 
                        // Since MentionList uses document.keydown, preventing default here might be enough IF the event bubbles.
                        // But React synthetic events vs native...
                        // Let's rely on MentionList's document listener for logic, but preventDefault here to stop cursor.
                        return
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault()
                        // MentionList handles the selection via document listener
                        return
                    }
                    if (e.key === "Escape") {
                        setMentionState(prev => ({...prev, active: false}))
                        return
                    }
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              disabled={status === "generating"}
              autoFocus
            />
            
            <AnimatePresence>
                {mentionState.active && (
                    <MentionList 
                        contacts={contacts}
                        query={mentionState.query}
                        onSelect={handleSelectContact}
                        onClose={() => setMentionState(prev => ({...prev, active: false}))}
                        position={{ top: mentionState.top, left: mentionState.left }}
                        isLoading={isSearching}
                    />
                )}
            </AnimatePresence>

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-2">
              <button
                className={`p-2.5 rounded-full transition-all duration-300 ${isListening ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50 animate-pulse" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}
                onClick={isListening ? stopListening : startListening}
                disabled={status === "generating"}
              >
                <Mic size={18} />
              </button>

              <button
                onClick={handleGenerate}
                disabled={!textInput.trim() || status === "generating" || !ready}
                className={`
                                            flex items-center justify-center p-2.5 rounded-2xl transition-all duration-300
                                            ${!textInput.trim() || status === "generating"
                    ? "bg-white/5 text-gray-500 cursor-not-allowed"
                    : "bg-white text-black hover:scale-105 active:scale-95 shadow-lg shadow-white/10"}
                                        `}
              >
                {status === "generating" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>

          {status === "error" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              {errorMessage || "Something went wrong."}
            </div>
          )}
        </motion.div>
      )
    }

    // Review / Success State
    return (
      <motion.div
        key="review"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {status === "success" ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-green-500/30">
              <Check size={32} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Scheduled!</h3>
            <p className="text-gray-400 text-sm">Your events have been added to the calendar.</p>
          </div>
        ) : (
          <>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 -mr-2 scrollbar-none">
              {generatedEvents.map((evt, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-4 rounded-2xl transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-white/90 text-sm leading-tight">{evt.summary}</h3>
                      {evt.location && (
                        <p className="text-xs text-white/40 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-white/30"></span>
                          {evt.location}
                        </p>
                      )}
                    </div>
                    <div className="text-xs font-medium text-white/60 bg-white/5 px-2 py-1 rounded-lg whitespace-nowrap">
                      {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ""}
                      <div className="text-[10px] text-white/30 text-right uppercase tracking-wider mt-0.5">
                        {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ""}
                      </div>
                    </div>
                  </div>
                  {evt.description && (
                    <p className="mt-2 text-xs text-white/40 line-clamp-2 px-0.5">{evt.description}</p>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-medium transition-all text-sm group"
              >
                <RefreshCcw size={16} className="group-hover:-rotate-180 transition-transform duration-500" />
                <span>Retry</span>
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all shadow-lg shadow-white/5 active:scale-95 text-sm"
              >
                {status === "creating" ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                <span>Add to Calendar</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    )
  }
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] font-sans grid w-full max-w-xl pointer-events-none justify-items-center items-end">
      {/* Main Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="col-start-1 row-start-1 pointer-events-auto w-full bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl overflow-visible ring-1 ring-white/5 z-20"
          >
            {/* Header - Minimal */}
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <div className="flex items-center gap-2 text-white/50 text-sm font-medium tracking-tight">
                <LannerAILogo className="h-4 w-4" />
                <span>
                  {isOnboarding ? "Setup" : (status === "review" ? "Review Plan" : "New Event")}
                </span>
              </div>
              <button
                onClick={toggleOverlay}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 pt-2">
              <AnimatePresence mode="wait">
                {isOnboarding ? (
                  <Onboarding key="onboarding" onComplete={handleOnboardingComplete} />
                ) : (
                  <motion.div
                    key="main-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <AnimatePresence mode="wait">
                      {renderMainContent()}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button - Modern Icon */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleOverlay}
            className="col-start-1 row-start-1 pointer-events-auto h-14 w-14 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white rounded-full shadow-2xl shadow-black/50 flex items-center justify-center ring-1 ring-white/10 group z-10"
          >
            <LannerAILogo className="hover:rotate-12 transition-transform duration-300" />
            <span className="sr-only">Plan Events</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
