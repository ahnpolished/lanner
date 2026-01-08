import { motion } from "framer-motion"
import { ShieldCheck, Zap, ArrowRight, Server, Lock } from "lucide-react"
import { useState } from "react"
import type { AIPreference } from "~lib/storage"

interface OnboardingProps {
    onComplete: (preference: AIPreference) => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
    const [selected, setSelected] = useState<AIPreference>(null)

    const handleSelect = (pref: AIPreference) => {
        setSelected(pref)
    }

    const handleConfirm = () => {
        if (selected) {
            onComplete(selected)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col h-full p-1"
        >
            <div className="text-center space-y-2 mb-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">Choose your setup</h2>
                <p className="text-white/40 text-sm">Select how you want Lanner to power your calendar.</p>
            </div>

            <div className="grid gap-3 mb-6">
                {/* Safe Option */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect("safe")}
                    className={`relative p-4 rounded-2xl border text-left transition-all duration-200 group ${selected === "safe"
                        ? "bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selected === "safe" ? "bg-blue-500 text-white" : "bg-white/10 text-white/60 group-hover:text-white"}`}>
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h3 className={`font-semibold text-sm ${selected === "safe" ? "text-white" : "text-white/90"}`}>
                                    Private & Safe
                                </h3>
                                <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400">Recommended</span>
                            </div>
                        </div>
                        {selected === "safe" && <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />}
                    </div>
                    <p className="mt-3 text-xs text-white/50 leading-relaxed">
                        Runs entirely on your device using Chrome's built-in AI. Your data never leaves your browser.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30 font-mono">
                        <Lock size={10} />
                        <span>Offline capable</span>
                    </div>
                </motion.button>

                {/* Fast Option */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect("fast")}
                    className={`relative p-4 rounded-2xl border text-left transition-all duration-200 group ${selected === "fast"
                        ? "bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${selected === "fast" ? "bg-amber-500 text-white" : "bg-white/10 text-white/60 group-hover:text-white"}`}>
                                <Zap size={20} />
                            </div>
                            <div>
                                <h3 className={`font-semibold text-sm ${selected === "fast" ? "text-white" : "text-white/90"}`}>
                                    Cloud Fast
                                </h3>
                                <span className="text-[10px] uppercase tracking-wider font-medium text-amber-400">Experimental</span>
                            </div>
                        </div>
                        {selected === "fast" && <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />}
                    </div>
                    <p className="mt-3 text-xs text-white/50 leading-relaxed">
                        Powered by Lanner's remote cloud models. Zero setup required and instantly available.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30 font-mono">
                        <Server size={10} />
                        <span>Internet required</span>
                    </div>
                </motion.button>
            </div>

            <div className="mt-auto">
                <button
                    onClick={handleConfirm}
                    disabled={!selected}
                    className={`w-full py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 ${selected
                        ? "bg-white text-black shadow-lg shadow-white/10 hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-white/5 text-white/20 cursor-not-allowed"
                        }`}
                >
                    <span>Continue</span>
                    <ArrowRight size={16} />
                </button>
            </div>
        </motion.div>
    )
}
