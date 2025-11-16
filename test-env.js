import dotenv from "dotenv"

// Load environment variables
dotenv.config()

console.log("=== Environment Variables Test ===")
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI)
console.log("MONGODB_URI value:", process.env.MONGODB_URI?.substring(0, 50) + "...")
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY)
console.log("GEMINI_API_KEY length:", process.env.GEMINI_API_KEY?.length)
console.log("GEMINI_MODEL:", process.env.GEMINI_MODEL)

// Test config imports
console.log("\n=== Testing Config Imports ===")
try {
  await import("./src/config/database.js")
  console.log("✅ Database config loaded successfully")
} catch (error) {
  console.log("❌ Database config error:", error.message)
}

try {
  const geminiConfig = await import("./src/config/gemini.js")
  console.log("✅ Gemini config loaded successfully")
} catch (error) {
  console.log("❌ Gemini config error:", error.message)
}