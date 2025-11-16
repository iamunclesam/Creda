import User from "../models/User.js"

export async function getOrCreateUser(phoneNumber, whatsappName = null) {
  try {
    let user = await User.findOne({ whatsappPhoneNumber: phoneNumber })

    if (!user) {
      user = new User({
        whatsappPhoneNumber: phoneNumber,
        whatsappName: whatsappName || "User",
        onboardingStep: "ask_name",
      })
      await user.save()
      console.log("[UserService] Created new user:", phoneNumber)
    }

    return user
  } catch (error) {
    console.error("[UserService] Error getting/creating user:", error)
    throw error
  }
}

export async function updateUserProfile(userId, { name, email }) {
  try {
    const user = await User.findByIdAndUpdate(userId, { name, email, updatedAt: new Date() }, { new: true })
    return user
  } catch (error) {
    console.error("[UserService] Error updating user profile:", error)
    throw error
  }
}

export async function updateOnboardingStep(userId, step) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { onboardingStep: step, updatedAt: new Date() },
      { new: true }
    )
    return user
  } catch (error) {
    console.error("[UserService] Error updating onboarding step:", error)
    throw error
  }
}

export async function setUserName(userId, name) {
  try {
    const user = await User.findByIdAndUpdate(userId, { name, updatedAt: new Date() }, { new: true })
    return user
  } catch (error) {
    console.error("[UserService] Error setting user name:", error)
    throw error
  }
}

export async function setUserEmail(userId, email) {
  try {
    const user = await User.findByIdAndUpdate(userId, { email, updatedAt: new Date() }, { new: true })
    return user
  } catch (error) {
    console.error("[UserService] Error setting user email:", error)
    throw error
  }
}

export async function getUserByPhoneNumber(phoneNumber) {
  try {
    return await User.findOne({ whatsappPhoneNumber: phoneNumber })
  } catch (error) {
    console.error("[UserService] Error fetching user:", error)
    return null
  }
}

export async function addConversationMessage(userId, role, content) {
  try {
    const user = await User.findById(userId)
    if (user) {
      user.conversationHistory.push({
        role,
        content,
        timestamp: new Date(),
      })
      if (user.conversationHistory.length > 20) {
        user.conversationHistory = user.conversationHistory.slice(-20)
      }
      await user.save()
    }
  } catch (error) {
    console.error("[UserService] Error adding message:", error)
  }
}

export async function getConversationHistory(userId) {
  try {
    const user = await User.findById(userId)
    return user?.conversationHistory || []
  } catch (error) {
    console.error("[UserService] Error getting history:", error)
    return []
  }
}

// =========================
// Fiat account helpers
// =========================

export async function getFiatAccount(userId) {
  try {
    const user = await User.findById(userId)
    return user?.fiatAccount || null
  } catch (error) {
    console.error("[UserService] Error getting fiat account:", error)
    return null
  }
}

export async function setFiatAccount(userId, fiatAccount) {
  try {
    const update = {
      fiatAccount: {
        ...fiatAccount,
        createdAt: fiatAccount?.createdAt || new Date(),
      },
      updatedAt: new Date(),
    }
    const user = await User.findByIdAndUpdate(userId, update, { new: true })
    return user?.fiatAccount || null
  } catch (error) {
    console.error("[UserService] Error setting fiat account:", error)
    throw error
  }
}

export async function ensureFiatAccount(userId) {
  try {
    const user = await User.findById(userId)
    if (!user) return null

    if (user.fiatAccount && user.fiatAccount.status === "active") {
      return user.fiatAccount
    }

    const simulatedAccountNumber = `SIM${Math.floor(Math.random() * 1e9)}`
    const fiatAccount = {
      provider: "mockbank",
      bankName: "IOTA Bank",
      accountId: `acc_${user._id.toString()}`,
      accountName: user.name || user.whatsappName || "User",
      accountNumber: simulatedAccountNumber,
      currency: "USD",
      country: "US",
      status: "active",
      createdAt: new Date(),
    }

    user.fiatAccount = fiatAccount
    user.updatedAt = new Date()
    await user.save()
    return fiatAccount
  } catch (error) {
    console.error("[UserService] Error ensuring fiat account:", error)
    return null
  }
}
