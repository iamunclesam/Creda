import mongoose from "mongoose"
import dotenv from "dotenv"

// Load environment variables if not already loaded
dotenv.config()

let isConnected = false

export const connectDB = async () => {
  try {
    if (isConnected) {
      console.log("[DB] Using existing database connection")
      return
    }

    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/whatsapp-crypto-bot"

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    isConnected = conn.connections[0].readyState === 1
    console.log("[DB] Connected to MongoDB:", conn.connection.host)
    return conn
  } catch (error) {
    console.error("[DB] Connection error:", error.message)
    throw error
  }
}

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect()
    isConnected = false
    console.log("[DB] Disconnected from MongoDB")
  }
}
