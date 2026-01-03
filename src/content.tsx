import cssText from "data-text:style.css"
import type { PlasmoCSConfig } from "plasmo"

import CalendarOverlay from "./components/CalendarOverlay"

export const config: PlasmoCSConfig = {
  matches: ["https://calendar.google.com/*"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText.replaceAll(':root', ':host(plasmo-csui)');
  return style
}

export default function Content() {
  return <CalendarOverlay />
}
