import dotenv from "dotenv"
dotenv.config()

import makeWASocket from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import { connectDB } from "./src/config/database.js"
import { handleMessage } from "./src/handlers/messageHandler.js"
import { getOrCreateUser } from "./src/services/userService.js"


let sock
let state
let saveCreds

async function initializeAuthState() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const authResult = await import("@whiskeysockets/baileys").then((module) =>
    module.useMultiFileAuthState("./auth_info_baileys"),
  )
  state = authResult.state
  saveCreds = authResult.saveCreds
}

async function connectWhatsApp() {
  try {
    if (!state || !saveCreds) {
      await initializeAuthState()
    }

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ["WhatsApp Crypto Bot", "Chrome", "120.0"],
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log("[WhatsApp] Scan QR code with your phone")
        qrcode.generate(qr, { small: true })
      }

      if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
        console.log("[WhatsApp] Connection closed, reconnecting...", shouldReconnect)
        if (shouldReconnect) {
          setTimeout(connectWhatsApp, 1000)
        }
      } else if (connection === "open") {
        console.log("[WhatsApp] Connected successfully")
      }
    })

    sock.ev.on("messages.upsert", async (m) => {
      const message = m.messages[0]

      // Skip if no message content
      if (!message.message) return
      
      // Skip if message is from the bot itself
      if (message.key.fromMe) return
      
      // Skip group messages (groups have 'g.us' in the JID)
      if (message.key.remoteJid.endsWith('@g.us')) {
        console.log("[Bot] Ignoring group message from:", message.key.remoteJid)
        return
      }
      
      // Skip broadcast messages
      if (message.key.remoteJid.endsWith('@broadcast')) {
        console.log("[Bot] Ignoring broadcast message")
        return
      }

      // Only process direct messages (personal chats)
      if (message.key.remoteJid.endsWith('@s.whatsapp.net')) {
        try {
          const phoneNumber = message.key.remoteJid.split("@")[0]
          const senderName = message.pushName || "User"

          console.log(`[Bot] Processing message from ${senderName} (${phoneNumber})`)
          
          await getOrCreateUser(phoneNumber, senderName)
          await handleMessage(message, sock)
        } catch (error) {
          console.error("[Bot] Error processing message:", error)
        }
      } else {
        console.log("[Bot] Ignoring message from unknown JID type:", message.key.remoteJid)
      }
    })
  } catch (error) {
    console.error("[WhatsApp] Connection error:", error)
    setTimeout(connectWhatsApp, 1000)
  }
}

async function start() {
  try {
    console.log("[Bot] Starting WhatsApp AI Crypto Bot...")
    console.log("[Bot] Configuration: Ignoring group messages, only processing direct messages")

    await connectDB()
    await connectWhatsApp()

    console.log("[Bot] Bot is running (Direct messages only)")
  } catch (error) {
    console.error("[Bot] Fatal error:", error)
    process.exit(1)
  }
}

start().catch(console.error)

process.on("SIGINT", async () => {
  console.log("[Bot] Shutting down gracefully...")
  if (sock) {
    await sock.end()
  }
  process.exit(0)
})