import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
  whatsappPhoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  whatsappName: String,
  email: String,
  name: String,
  onboardingStep: {
    type: String,
    enum: ["ask_name", "ask_email", "ready_wallet", "completed"],
    default: "ask_name",
    index: true,
  },
  connectedWalletAddress: {
    type: String,
    index: true,
  },
  walletType: {
    type: String,
    enum: ["metamask", "coinbase", "ledger", "custom", "custodial"],
    default: "custom",
  },
  userStatus: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },
  balances: {
    eth: {
      type: String,
      default: "0",
    },
    hyperliquid: {
      type: String,
      default: "0",
    },
  },
  conversationHistory: [
    {
      role: String,
      content: String,
      timestamp: Date,
    },
  ],
  custodialWallet: {
   address: String,
   encryptedKey: String,
   createdAt: Date,
  },

  // New: user's fiat account details for off-ramp
  fiatAccount: {
    provider: String,         // e.g., "mockbank", "stripe", "wise"
    bankName: String,         // e.g., "IOTA Bank"
    accountId: String,        // external provider account id
    accountName: String,      // account holder name
    accountNumber: String,    // masked or simulated account number
    currency: {
      type: String,
      default: "USD",
    },
    country: String,
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdAt: Date,
  },

  kycVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

const User = mongoose.model("User", userSchema)
export default User
