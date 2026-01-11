import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarAssistant } from "./CalendarAssistant"
import { LannerAILogo } from "./LannerAILogo"

export default function CalendarOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOverlay = () => {
    setIsOpen(!isOpen)
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
            <CalendarAssistant onClose={toggleOverlay} onSuccess={() => {
                setTimeout(() => setIsOpen(false), 2000)
            }} />
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