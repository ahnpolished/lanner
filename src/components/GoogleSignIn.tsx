import { motion } from "framer-motion"
import { Chrome, ArrowRight, AlertCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { getAuthToken } from "~lib/calendar"

interface GoogleSignInProps {
  onSuccess: () => void
}

export function GoogleSignIn({ onSuccess }: GoogleSignInProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await getAuthToken(true)
      onSuccess()
    } catch (e: any) {
      console.error("Sign in failed", e)
      setError(e.toString() || "Failed to sign in. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full p-1 items-center justify-center text-center space-y-6"
    >
      <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10">
        <Chrome size={32} className="text-white" />
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="text-xl font-bold text-white tracking-tight">Connect Google Calendar</h2>
        <p className="text-white/40 text-sm">
          Lanner needs access to your calendar to schedule events for you.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 max-w-xs text-left">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleSignIn}
        disabled={isLoading}
        className={`
                    group relative px-6 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all duration-300
                    ${isLoading ? "bg-white/10 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200 active:scale-95 shadow-lg shadow-white/10"}
                `}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <span>Sign in with Google</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </motion.div>
  )
}
