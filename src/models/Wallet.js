import mongoose from "mongoose"

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
    index: true,
  },
  walletName: String,
  isConnected: {
    type: Boolean,
    default: true,
  },
  isCustodial: {
    type: Boolean,
    default: false,
    index: true,
  },
  chainType: {
    type: String,
    enum: ["ethereum", "hyperliquid", "solana", "polygon", "iota-evm"],
    default: "ethereum",
  },
  network: {
    type: Number,
  },
  connectedAt: Date,
  disconnectedAt: Date,
  lastUsedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const Wallet = mongoose.model("Wallet", walletSchema)
export default Wallet
