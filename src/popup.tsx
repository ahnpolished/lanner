import { motion } from "framer-motion"
import { CalendarAssistant } from "~components/CalendarAssistant"
import "./style.css"

function IndexPopup() {
  return (
    <motion.div
      id="lanner-popup-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-[500px] bg-[#0a0a0a] min-h-[350px] text-white p-0 font-sans overflow-hidden flex flex-col"
    >
        <CalendarAssistant headerTitle="Lanner Assistant" />
    </motion.div>
  )
}

export default IndexPopup