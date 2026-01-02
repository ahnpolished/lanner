import { useState } from "react"
import { useStructuredPrompt } from "@ahnopologetic/use-prompt-api/react"
import { z } from "zod"

import "../style.css"

const eventSchema = z.object({
    title: z.string(),
    start: z.string().describe("ISO 8601 string, e.g. 2024-01-01T12:00:00"),
    end: z.string().describe("ISO 8601 string"),
    location: z.string().optional(),
    description: z.string().optional()
})

export default function Playground() {
    const [input, setInput] = useState("")
    const [result, setResult] = useState<any>(null)

    const { prompt, ready, loading, error, quota } = useStructuredPrompt({
        schema: eventSchema,
        systemPrompt: `You are a helpful calendar assistant. The current time is ${new Date().toISOString()}.`
    })

    const handleGenerate = async () => {
        if (!input.trim()) return
        setResult(null)
        const data = await prompt(`Create an event plan for: ${input}`)
        setResult(data)
    }

    return (
        <div className="plasmo-p-8 plasmo-bg-gray-100 plasmo-min-h-screen plasmo-font-sans">
            <div className="plasmo-max-w-2xl plasmo-mx-auto plasmo-bg-white plasmo-p-6 plasmo-rounded-xl plasmo-shadow-lg">
                <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-mb-4">
                    AI Playground (use-prompt-api)
                </h1>

                <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-blue-50 plasmo-rounded-lg">
                    <p className="plasmo-font-semibold">
                        Status: {ready ? "Ready" : "Initializing..."}
                    </p>
                    {quota && (
                        <p className="plasmo-text-sm plasmo-text-gray-600">
                            Quota: {quota.uleft} left
                        </p>
                    )}
                    {error && (
                        <p className="plasmo-text-sm plasmo-text-red-600">
                            Error: {error.message}
                        </p>
                    )}
                </div>

                <textarea
                    className="plasmo-w-full plasmo-p-3 plasmo-border plasmo-rounded-lg plasmo-mb-4 plasmo-h-32 focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                    placeholder="e.g. Lunch with John tomorrow at 12pm..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />

                <button
                    onClick={handleGenerate}
                    disabled={loading || !ready}
                    className="plasmo-px-6 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-lg hover:plasmo-bg-blue-700 disabled:plasmo-opacity-50 plasmo-transition-colors"
                >
                    {loading ? "Generating..." : "Generate Plan"}
                </button>

                {result && (
                    <div className="plasmo-mt-6">
                        <h2 className="plasmo-font-semibold plasmo-mb-2">Output:</h2>
                        <pre className="plasmo-bg-gray-900 plasmo-text-green-400 plasmo-p-4 plasmo-rounded-lg plasmo-overflow-x-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}
