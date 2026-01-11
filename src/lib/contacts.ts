import { getAuthToken } from "./calendar"

export interface Contact {
  id: string
  name: string
  email: string
  photoUrl?: string
  lastContacted?: number // timestamp
}

const CACHE_KEY = "lanner_contacts_cache"
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

interface ContactsCache {
  data: Contact[]
  timestamp: number
}

export async function getContacts(forceRefresh = false): Promise<Contact[]> {
  if (!forceRefresh) {
    const cache = await chrome.storage.local.get(CACHE_KEY)
    const cachedData = cache[CACHE_KEY] as ContactsCache | undefined
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
      console.debug("Using cached contacts", cachedData.data.length)
      return cachedData.data
    }
  }

  try {
    const token = await getAuthToken(false) // Try silent first
    const contacts = await fetchAllContacts(token)

    await chrome.storage.local.set({
      [CACHE_KEY]: {
        data: contacts,
        timestamp: Date.now()
      }
    })

    return contacts
  } catch (e) {
    console.error("Failed to fetch contacts", e)
    return []
  }
}

async function fetchAllContacts(token: string): Promise<Contact[]> {
  // Parallel fetch from all sources
  const [connections, otherContacts, recentAttendees] = await Promise.all([
    fetchConnections(token),
    fetchOtherContacts(token),
    fetchRecentAttendees(token)
  ])

  // Merge and deduplicate by email
  const map = new Map<string, Contact>()

  // 1. Prioritize explicit connections (People API)
  connections.forEach(c => map.set(c.email, c))

  // 2. Add 'other contacts' (frequent contacts)
  otherContacts.forEach(c => {
    if (!map.has(c.email)) {
      map.set(c.email, c)
    }
  })

  // 3. Add recent meeting attendees (Calendar API)
  recentAttendees.forEach(c => {
    if (!map.has(c.email)) {
      map.set(c.email, c)
    }
  })

  return Array.from(map.values())
}

export async function searchContacts(query: string): Promise<Contact[]> {
  if (!query || query.length < 2) return []

  try {
    const token = await getAuthToken(false)
    const url = `https://people.googleapis.com/v1/otherContacts:search?query=${encodeURIComponent(query)}&readMask=names,emailAddresses,photos`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) return []

    const data = await res.json()
    if (!data.results) return []

    return data.results.map((result: any) => {
      const item = result.person
      const name = item.names?.[0]?.displayName || item.emailAddresses?.[0]?.value || "Unknown"
      const email = item.emailAddresses?.[0]?.value
      const photoUrl = item.photos?.[0]?.url

      if (!email) return null

      return {
        id: item.resourceName || email,
        name,
        email,
        photoUrl
      }
    }).filter((c: any) => c !== null) as Contact[]
  } catch (e) {
    console.warn("Error searching contacts", e)
    return []
  }
}

async function fetchConnections(token: string): Promise<Contact[]> {
  const url = "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=1000"
  return fetchPeople(url, token)
}

async function fetchOtherContacts(token: string): Promise<Contact[]> {
  const url = "https://people.googleapis.com/v1/otherContacts?readMask=names,emailAddresses,photos&pageSize=1000"
  return fetchPeople(url, token, true)
}

async function fetchRecentAttendees(token: string): Promise<Contact[]> {
  try {
    // Fetch last 30 days of events
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=${thirtyDaysAgo.toISOString()}&maxResults=250`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) return []

    const data = await res.json()
    if (!data.items) return []

    const contactsMap = new Map<string, Contact>()

    data.items.forEach((event: any) => {
      if (event.attendees) {
        event.attendees.forEach((att: any) => {
          if (att.email && !att.self && !att.resource) {
            if (!contactsMap.has(att.email)) {
              contactsMap.set(att.email, {
                id: att.email,
                name: att.displayName || att.email.split('@')[0],
                email: att.email,
                // Calendar API doesn't give photos easily, leave undefined
              })
            }
          }
        })
      }
    })

    return Array.from(contactsMap.values())

  } catch (e) {
    console.warn("Error fetching recent attendees", e)
    return []
  }
}

async function fetchPeople(url: string, token: string, isOther = false): Promise<Contact[]> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) return []

    const data = await res.json()
    const list = isOther ? data.otherContacts : data.connections

    if (!list) return []

    return list.map((item: any) => {
      const name = item.names?.[0]?.displayName || item.emailAddresses?.[0]?.value || "Unknown"
      const email = item.emailAddresses?.[0]?.value
      const photoUrl = item.photos?.[0]?.url

      if (!email) return null

      return {
        id: item.resourceName || email,
        name,
        email,
        photoUrl
      }
    }).filter((c: any) => c !== null) as Contact[]
  } catch (e) {
    console.warn("Error fetching specific contact list", e)
    return []
  }
}
