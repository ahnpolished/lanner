import { createEventDirect, getAuthToken } from "~lib/calendar"

export { }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CREATE_EVENT") {
    console.debug("Creating event:", request.payload)
    createEventDirect(request.payload)
      .then((data) => sendResponse({ data }))
      .catch((error) => sendResponse({ error: error.message }))

    // Return true to indicate async response
    return true
  }

  if (request.type === "GET_AUTH_TOKEN") {
    console.debug("Getting auth token, interactive:", request.payload.interactive)
    getAuthToken(request.payload.interactive)
      .then((token) => sendResponse({ token }))
      .catch((error) => sendResponse({ error: error.toString() }))

    return true
  }
})
