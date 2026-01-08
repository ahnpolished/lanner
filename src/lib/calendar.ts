export interface CalendarEvent {
    summary: string
    description?: string
    location?: string
    start: {
        dateTime: string
        timeZone?: string
    }
    end: {
        dateTime: string
        timeZone?: string
    }
}

const LANNER_PREFIX = '📔 '
const TOKEN_CACHE_KEY = 'lanner_auth_token'

interface TokenCache {
    token: string
    timestamp: number
}

export const getAuthToken = async (interactive: boolean = true): Promise<string> => {
    // 1. Check Cache
    const cache = await chrome.storage.local.get(TOKEN_CACHE_KEY)
    const cachedData = cache[TOKEN_CACHE_KEY] as TokenCache | undefined

    // Token is valid for ~60 mins usually. Let's be safe with 50 mins.
    const MAX_AGE = 50 * 60 * 1000
    const now = Date.now()

    if (cachedData && cachedData.token && (now - cachedData.timestamp < MAX_AGE)) {
        console.debug("Using cached token")
        return cachedData.token
    }

    // 2. Fetch New Token
    if (typeof chrome.identity !== "undefined") {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(chrome.runtime.lastError?.message || "No token received")
                } else {
                    // Cache the new token
                    chrome.storage.local.set({
                        [TOKEN_CACHE_KEY]: {
                            token,
                            timestamp: Date.now()
                        }
                    })
                    resolve(token)
                }
            })
        })
    } else {
        // Fallback: Delegate to Background Script (e.g. from Content Script)
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: "GET_AUTH_TOKEN", payload: { interactive } },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError.message)
                    } else if (response && response.error) {
                        reject(response.error)
                    } else if (response && response.token) {
                        resolve(response.token)
                    } else {
                        reject("Failed to retrieve token from background")
                    }
                }
            )
        })
    }
}

export const clearTokenCache = async () => {
    await chrome.storage.local.remove(TOKEN_CACHE_KEY)
    // Also try to remove from identity cache if possible/needed, but usually explicit removeCachedAuthToken is good
    // For now, clearing local storage cache forces a new getAuthToken call which validates freshness
}

export const createEventDirect = async (event: CalendarEvent) => {
    let token = await getAuthToken(true)
    const modifiedEvent = {
        ...event,
        summary: LANNER_PREFIX + event.summary,
    }

    const makeRequest = async (authToken: string) => {
        return fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(modifiedEvent),
            }
        )
    }

    let response = await makeRequest(token)

    // Handle 401 Unauthorized - Retry once with fresh token
    if (response.status === 401) {
        console.log("Token invalid/expired. Refreshing...")
        // Invalidate cache
        await clearTokenCache()
        // Try to clear identity cache too to be sure
        await new Promise<void>((resolve) => {
            chrome.identity.removeCachedAuthToken({ token }, () => resolve())
        })

        // Fetch fresh token
        token = await getAuthToken(true)
        response = await makeRequest(token)
    }

    if (!response.ok) {
        const error = await response.json()
        console.error({ error })
        throw new Error(error.error?.message || "Failed to create event")
    }

    return response.json()
}

export const createEvent = async (event: CalendarEvent) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: "CREATE_EVENT", payload: event },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError)
                } else if (response.error) {
                    reject(new Error(response.error))
                } else {
                    resolve(response.data)
                }
            }
        )
    })
}
