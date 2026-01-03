import { usePromptAPI } from "@ahnopologetic/use-prompt-api/react"
import { AnimatePresence, motion } from "framer-motion"
import { Calendar, Check, Download, Loader2, Mic, RefreshCcw, Send } from "lucide-react"
import { useEffect, useState } from "react"

import { LannerAILogo } from "~components/LannerAILogo"
import { useSpeechRecognition } from "./hooks/useSpeechRecognition"
import { createEvent, type CalendarEvent } from "./lib/calendar"
import "./style.css"

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

function IndexPopup() {
  const [textInput, setTextInput] = useState("")
  const [generatedEvents, setGeneratedEvents] = useState<CalendarEvent[]>([])

  // Status can include specific count if needed, but for now simple
  const [status, setStatus] = useState<"idle" | "generating" | "review" | "creating" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  // Model download states
  const [capabilityStatus, setCapabilityStatus] = useState<string>("unknown")
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition()

  const { prompt, ready } = usePromptAPI({
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
        ${"   "}- Do not add any markdown formatting (no \`\`\`json). Just the raw JSON string.
        `
  })

  useEffect(() => {
    checkCapabilities()
  }, [])

  // Sync speech transcript to text input
  useEffect(() => {
    if (transcript) {
      setTextInput((prev) => prev ? prev + " " + transcript : transcript)
      resetTranscript()
    }
  }, [transcript, resetTranscript])

  const checkCapabilities = async () => {
    try {
      const availability = await LanguageModel.availability()
      setCapabilityStatus(availability)
    } catch (e) {
      setCapabilityStatus("unknown")
    }
  }

  const handleDownloadModel = async () => {
    setIsDownloading(true)
    try {
      await LanguageModel.create({
        monitor(m: any) {
          m.addEventListener("downloadprogress", (e: any) => {
            console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`)
            setDownloadProgress(e.loaded / e.total)
          })
        },
      })
      setCapabilityStatus("readily")
    } catch (e: any) {
      setErrorMessage(`Download failed: ${e.message}`)
      setStatus("error")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleGenerate = async () => {
    if (!textInput.trim() || !ready) return
    setStatus("generating")
    setErrorMessage("")

    try {
      const rawResult = await prompt(`User Request: ${textInput}`)

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

  return (
    <motion.div
      id="lanner-popup-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-[500px] bg-[#0a0a0a] min-h-[300px] text-white p-0 font-sans overflow-hidden"
    >
      {/* Header - Minimal */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2 border-b border-white/5 bg-[#0a0a0a] sticky top-0 z-10">
        <div className="flex items-center gap-2 text-white/50 text-sm font-medium tracking-tight">
          <LannerAILogo className="h-4 w-4" />
          <span>{status === "review" ? "Review Plan" : "New Event"}</span>
        </div>
        {/* No close button needed for popup */}
      </div>

      <div className="p-6 pt-2">
        {/* Capability Check / Download View */}
        <AnimatePresence mode="wait">
          {capabilityStatus !== "available" && capabilityStatus !== "readily" && capabilityStatus !== "unknown" ? (
            <motion.div
              key="download"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center py-6 space-y-4"
            >
              <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10">
                <Download size={24} className="text-blue-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white tracking-tight">
                  {capabilityStatus === "no" ? "Model Not Available" : "AI Model Needed"}
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  {capabilityStatus === "no"
                    ? "The model is not available in your browser."
                    : "A small AI model needs to be downloaded to your browser."}
                </p>
              </div>

              {isDownloading ? (
                <div className="w-full max-w-xs space-y-2">
                  <div className="bg-white/10 rounded-full h-1 w-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono text-right">
                    {Math.round(downloadProgress * 100)}%
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleDownloadModel}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                >
                  Download Model
                </button>
              )}
            </motion.div>
          ) : (status === "idle" || status === "generating" || status === "error" ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="relative group">
                <textarea
                  className="w-full h-32 bg-transparent border-0 p-4 text-xl font-medium text-white placeholder-white/20 resize-none focus:ring-0 leading-relaxed outline-none"
                  placeholder="Coffee with Ryan tomorrow at 10am..."
                  style={{ fontFamily: "inherit" }}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
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
                      <Send size={20} className={textInput.trim() ? "translate-x-0.5" : ""} />
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
          ) : (
            // Review / Success State
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
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
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default IndexPopup
