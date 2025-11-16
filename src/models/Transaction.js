import mongoose from "mongoose"

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  transactionType: {
    type: String,
    enum: ["buy", "sell", "send", "receive", "withdraw"],
    required: true,
    index: true,
  },
  token: {
    type: String,
    enum: ["ETH", "HYPE", "USD"],
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  valueUSD: String,
  fromWallet: String,
  toWallet: String,
  txHash: String,
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
    index: true,
  },
  feeAmount: String,
  feeToken: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  completedAt: Date,
})

const Transaction = mongoose.model("Transaction", transactionSchema)
export default Transaction
