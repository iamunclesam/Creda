import { detectIntent } from "../config/gemini.js"
import { getUserByPhoneNumber, addConversationMessage, getConversationHistory, updateOnboardingStep, setUserName, setUserEmail } from "../services/userService.js"
import { executeCommand } from "./commandHandler.js"

export async function handleMessage(msg, sock) {
  try {
    const phoneNumber = msg.key.remoteJid.split("@")[0]
    const userMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ""

    if (!userMessage) return

    console.log(`[MessageHandler] Message from ${phoneNumber}: ${userMessage}`)

    const user = await getUserByPhoneNumber(phoneNumber)
    // Onboarding flow: capture full name, then email, then prompt wallet creation
    if (user && user.onboardingStep !== "completed") {
      const remoteJid = msg.key.remoteJid

      // Simple validators
      const isLikelyName = (text) => {
        const cleaned = text.trim()
        // Must contain letters and at least one space (first + last), avoid numbers and symbols
        return /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(cleaned) && !/[0-9@]/.test(cleaned)
      }
      const isValidEmail = (text) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())
      }

      if (user.onboardingStep === "ask_name" || !user.name) {
        if (isLikelyName(userMessage)) {
          await setUserName(user._id, userMessage.trim())
          await updateOnboardingStep(user._id, "ask_email")
          await sock.sendMessage(remoteJid, {
            text: "Great, thanks! Please provide your email address (we’ll send helpful updates).",
          })
        } else {
          await sock.sendMessage(remoteJid, {
            text: "👋 Welcome to IOTA EVM Crypto Bot! What’s your full name (first and last)?",
          })
        }
        return
      }

      if (user.onboardingStep === "ask_email" || !user.email) {
        if (isValidEmail(userMessage)) {
          await setUserEmail(user._id, userMessage.trim())
          await updateOnboardingStep(user._id, "ready_wallet")
          await sock.sendMessage(remoteJid, {
            text: `Awesome! We’ve saved your details.\n\n• Name: ${user.name || "—"}\n• Email: ${userMessage.trim()}\n• WhatsApp: ${phoneNumber}\n\nWould you like to proceed to create your IOTA EVM wallet now? Reply 'create wallet' to continue.`,
          })
        } else {
          await sock.sendMessage(remoteJid, {
            text: "Please enter a valid email address (e.g., name@example.com).",
          })
        }
        return
      }

      if (user.onboardingStep === "ready_wallet") {
        // Encourage wallet creation explicitly; allow normal intent parsing
        // Fall through to normal flow so 'create wallet' is detected by AI
      }
    }

    await addConversationMessage(user._id, "user", userMessage)

    const history = await getConversationHistory(user._id)

    const intentData = await detectIntent(userMessage, history)

    await addConversationMessage(user._id, "assistant", intentData.message)

    await sock.sendMessage(msg.key.remoteJid, {
      text: intentData.message,
    })

    if (intentData.intent !== "unknown") {
      await executeCommand(user._id, phoneNumber, intentData, sock, msg)
    }
  } catch (error) {
    console.error("[MessageHandler] Error:", error)
    await sock.sendMessage(msg.key.remoteJid, {
      text: "Sorry, something went wrong. Please try again.",
    })
  }
}
