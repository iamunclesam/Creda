import Transaction from "../models/Transaction.js"
import mongoose from "mongoose"

export async function getTransactionHistory(userId, limit = 10) {
  try {
    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 }).limit(limit)
    return transactions
  } catch (error) {
    console.error("[TransactionService] Error fetching history:", error)
    throw error
  }
}

export async function getTransactionById(transactionId) {
  try {
    return await Transaction.findById(transactionId)
  } catch (error) {
    console.error("[TransactionService] Error fetching transaction:", error)
    return null
  }
}

export async function updateTransactionStatus(transactionId, status, txHash = null) {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        status,
        txHash: txHash || undefined,
        completedAt: status === "completed" ? new Date() : undefined,
      },
      { new: true },
    )
    return transaction
  } catch (error) {
    console.error("[TransactionService] Error updating transaction:", error)
    throw error
  }
}

export async function formatTransactionHistory(transactions) {
  return transactions
    .map((tx) => {
      const date = new Date(tx.createdAt).toLocaleDateString()
      const type = tx.transactionType.toUpperCase()
      const amount = `${tx.amount} ${tx.token}`
      const status = tx.status.charAt(0).toUpperCase() + tx.status.slice(1)

      return `${type} - ${amount} on ${date} (${status})`
    })
    .join("\n")
}

export async function getTransactionStats(userId) {
  try {
    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$transactionType",
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: "$valueUSD" } },
        },
      },
    ])
    return stats
  } catch (error) {
    console.error("[TransactionService] Error getting stats:", error)
    return []
  }
}
