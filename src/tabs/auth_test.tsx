import { useState } from "react"
import "../style.css"

export default function AuthTest() {
    const [token, setToken] = useState("")
    const [status, setStatus] = useState("")
    const [events, setEvents] = useState<any[]>([])

    const getAuthToken = () => {
        setStatus("Getting token...")
        chrome.identity.getAuthToken({ interactive: true }, (authToken) => {
            if (chrome.runtime.lastError) {
                setStatus(`Error: ${chrome.runtime.lastError.message}`)
                return
            }
            setToken(authToken)
            setStatus("Token received!")
        })
    }

    const listEvents = async () => {
        if (!token) return
        setStatus("Fetching events...")
        try {
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&orderBy=startTime&singleEvents=true",
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )
            const data = await response.json()
            if (data.error) {
                throw new Error(data.error.message)
            }
            setEvents(data.items || [])
            setStatus("Events fetched!")
        } catch (e) {
            setStatus(`Error fetching events: ${e.message}`)
        }
    }

    const createTestEvent = async () => {
        if (!token) return
        setStatus("Creating event...")
        const event = {
            summary: "Test Event from Chrome Extension",
            location: "Virtual",
            description: "This is a test event created via the Calendar API.",
            start: {
                dateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            },
            end: {
                dateTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
            },
        }

        try {
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(event),
                }
            )
            const data = await response.json()
            if (data.error) {
                throw new Error(data.error.message)
            }
            setStatus(`Event created! ID: ${data.id}`)
            listEvents() // Refresh list
        } catch (e) {
            setStatus(`Error creating event: ${e.message}`)
        }
    }

    return (
        <div className="plasmo-p-8 plasmo-bg-gray-100 plasmo-min-h-screen plasmo-font-sans">
            <div className="plasmo-max-w-2xl plasmo-mx-auto plasmo-bg-white plasmo-p-6 plasmo-rounded-xl plasmo-shadow-lg">
                <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-mb-4">
                    Google Calendar API Test
                </h1>

                <div className="plasmo-mb-6 plasmo-p-4 plasmo-bg-yellow-50 plasmo-rounded-lg border plasmo-border-yellow-200">
                    <p className="plasmo-font-medium text-yellow-800">
                        Status: {status || "Idle"}
                    </p>
                    {token && (
                        <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-2 plasmo-break-all">
                            Token: {token.substring(0, 20)}...
                        </p>
                    )}
                </div>

                <div className="plasmo-flex plasmo-gap-4 plasmo-mb-8">
                    <button
                        onClick={getAuthToken}
                        className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-blue-700 plasmo-transition"
                    >
                        1. Authorize
                    </button>

                    <button
                        onClick={listEvents}
                        disabled={!token}
                        className="plasmo-px-4 plasmo-py-2 plasmo-bg-green-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-green-700 disabled:plasmo-opacity-50 plasmo-transition"
                    >
                        2. List Events
                    </button>

                    <button
                        onClick={createTestEvent}
                        disabled={!token}
                        className="plasmo-px-4 plasmo-py-2 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 plasmo-transition"
                    >
                        3. Create Test Event
                    </button>
                </div>

                <div>
                    <h2 className="plasmo-font-bold plasmo-text-lg plasmo-mb-3">Upcoming Events</h2>
                    {events.length === 0 ? (
                        <p className="plasmo-text-gray-500 plasmo-italic">No events fetched yet.</p>
                    ) : (
                        <ul className="plasmo-space-y-3">
                            {events.map((evt) => (
                                <li key={evt.id} className="plasmo-p-3 plasmo-bg-gray-50 plasmo-rounded border">
                                    <p className="plasmo-font-semibold">{evt.summary || "(No Title)"}</p>
                                    <p className="plasmo-text-sm plasmo-text-gray-600">
                                        {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleString() : evt.start.date}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
