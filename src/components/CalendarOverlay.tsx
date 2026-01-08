import { useState, useEffect } from "react"
import { X, Mic, Send, Check, Loader2, RefreshCcw, Download, Sparkles, Calendar } from "lucide-react"
import { usePromptAPI } from "@ahnopologetic/use-prompt-api/react"
import { motion, AnimatePresence } from "framer-motion"

import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { createEvent, type CalendarEvent } from "../lib/calendar"
import { LannerAILogo } from "./LannerAILogo"
import { ModelDownloadStatus } from "./ModelDownloadStatus"
import { AIModelAvailability, normalizeAvailability } from "~lib/ai"
import { getUserConfig, saveUserConfig, type AIPreference } from "~lib/storage"
import { Onboarding } from "./Onboarding"


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

export default function CalendarOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [generatedEvents, setGeneratedEvents] = useState<CalendarEvent[]>([])

  const [status, setStatus] = useState<"idle" | "generating" | "review" | "creating" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Onboarding & Config
  const [isOnboarding, setIsOnboarding] = useState(true)

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

  // Check config when opening
  useEffect(() => {
    if (isOpen) {
      const checkConfig = async () => {
        const config = await getUserConfig()
        setIsOnboarding(!config.onboardingCompleted)
      }
      checkConfig()
    }
  }, [isOpen])

  const toggleOverlay = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setGeneratedEvents([])
      setStatus("idle")
    }
  }

  const handleOnboardingComplete = async (pref: AIPreference) => {
    await saveUserConfig({ aiPreference: pref, onboardingCompleted: true })
    setIsOnboarding(false)
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

  const renderMainContent = () => {
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
              className="w-full h-24 bg-transparent border-0 p-4 text-xl text-white placeholder-white/20 resize-none focus:ring-0 leading-relaxed focus:outline-none"
              placeholder="Coffee with Ryan tomorrow at 10am..."
              style={{ fontFamily: "inherit" }}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              disabled={status === "generating"}
              autoFocus
            />

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
            className="col-start-1 row-start-1 pointer-events-auto w-full bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5 z-20"
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
