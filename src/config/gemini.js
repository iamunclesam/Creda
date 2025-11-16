import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

console.log("[DEBUG] GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const geminiModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite-001",
  generationConfig: {
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    responseMimeType: "application/json",
  },
});

export async function detectIntent(userMessage, conversationHistory = []) {
  try {
    console.log("[DEBUG] Making Gemini API call...");

    const systemPrompt = `
    You are an AI intent detector and assistant for a WhatsApp crypto bot with an IOTA EVM vibe.
    Style: friendly, concise, confident; subtly reference IOTA/Shimmer EVM when relevant.
    Greetings should feel IOTA-flavored (e.g., "Hello! How can CREDA help you with you today?").
    Always respond ONLY in JSON format like this:
    {
      "intent": "connect_wallet|create_wallet|fetch_wallet|buy_token|send_token|convert_token|swap_token|withdraw_usd|show_history|disconnect_wallet|check_balance|connect_bank|unknown",
      "parameters": { "walletAddress": "", "token": "", "amount": "", "toAddress": "", "bankName": "", "accountNumber": "", "holderName": "" },
      "message": "Natural language reply",
      "requiresConfirmation": false,
      "nextStep": "What to ask next"
    }

    User message: """${userMessage}"""
    
    Guidance:
    - If the user says something like: "connect bank: IOTA Bank | 12345678 | Alice" then intent = "connect_bank" and parameters.bankName, parameters.accountNumber, parameters.holderName must be set.
    - If the user asks to withdraw but has no bank details, set intent = "withdraw_usd" with a helpful message prompting to connect a bank and set nextStep accordingly.
    `;

    const result = await geminiModel.generateContent(systemPrompt);
    const response = await result.response;
    const responseText = response.text();

    console.log("[DEBUG] Gemini response:", responseText);

    const cleanResponse = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error("[Gemini] API Error:", error.message);
    return {
      intent: "unknown",
      parameters: {},
      message: "Sorry, something went wrong with AI processing.",
      requiresConfirmation: false,
      nextStep: "Please try again.",
    };
  }
}
