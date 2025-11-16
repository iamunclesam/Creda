import WalletModel from "../models/Wallet.js";
import User from "../models/User.js";
import { Wallet, JsonRpcProvider } from "ethers";
import { NetworkEnum } from "@1inch/cross-chain-sdk";
import CryptoJS from "crypto-js";

// Updated for IOTA EVM - use IOTA EVM RPC by default
const provider = new JsonRpcProvider(process.env.RPC_URL || "https://json-rpc.evm.testnet.shimmer.network");
const ENCRYPTION_KEY = process.env.PRIVATE_KEY || "test_fallback_encryption_key_32bytes";

export async function createUserWallet(userId, chainType = "iota-evm") {
  try {
    console.log(`[WalletService] Creating custodial wallet for user: ${userId}`);

    // Generate new EVM wallet for user (custodial wallet)
    const wallet = Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;

    // Encrypt private key using CryptoJS (more secure)
    const encryptedKey = CryptoJS.AES.encrypt(privateKey, ENCRYPTION_KEY).toString();

    // Update User with both connectedWalletAddress AND custodialWallet
    await User.findByIdAndUpdate(
      userId,
      { 
        connectedWalletAddress: walletAddress,
        custodialWallet: {
          address: walletAddress, 
          encryptedKey: encryptedKey, 
          createdAt: new Date() 
        },
        walletType: "custodial",
        updatedAt: new Date()
      },
      { upsert: true }
    );

    // Save to WalletModel for connection tracking
    const newWallet = new WalletModel({
      userId,
      walletAddress,
      walletName: "Custodial Wallet",
      chainType,
      network: NetworkEnum.BASE,
      isConnected: true,
      isCustodial: true,
      connectedAt: new Date(),
      lastUsedAt: new Date()
    });

    await newWallet.save();

    console.log(`[WalletService] New custodial wallet created for user ${userId}: ${walletAddress}`);

    // Auto-fund with small test SMR (for IOTA EVM testnet)
    try {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        await fundWalletIfEmpty(walletAddress, "0.02");
      }
    } catch (fundError) {
      console.error("[WalletService] Auto-fund failed:", fundError.message);
      // Don't throw, just log - wallet creation should still succeed
    }

    return {
      success: true,
      walletAddress,
      message: "Custodial wallet created successfully",
    };
  } catch (error) {
    console.error("[WalletService] Error creating custodial wallet:", error);
    throw error;
  }
}

export async function connectOrCreateCustodialWallet(userId, chainType = "iota-evm") {
  try {
    // Check if user already has a custodial wallet in User model
    const user = await User.findById(userId);
    if (user?.custodialWallet?.encryptedKey) {
      console.log("[WalletService] Existing custodial wallet found in User model:", user.custodialWallet.address);
      
      // Ensure it's also in WalletModel
      let existingWallet = await WalletModel.findOne({ userId, isCustodial: true });
      if (!existingWallet) {
        existingWallet = new WalletModel({
          userId,
          walletAddress: user.custodialWallet.address,
          walletName: "Custodial Wallet",
          chainType,
          network: NetworkEnum.BASE,
          isConnected: true,
          isCustodial: true,
          connectedAt: new Date(),
          lastUsedAt: new Date()
        });
        await existingWallet.save();
      }
      
      return existingWallet;
    }

    // Create new custodial wallet
    return await createUserWallet(userId, chainType);
  } catch (error) {
    console.error("[WalletService] Error in connectOrCreateCustodialWallet:", error);
    throw error;
  }
}

export async function connectWallet(userId, walletAddress, chainType = "iota-evm") {
  try {
    const existingWallet = await WalletModel.findOne({ walletAddress, isConnected: true });
    if (existingWallet && existingWallet.userId.toString() !== userId) {
      throw new Error("Wallet already connected to another user");
    }

    let wallet = await WalletModel.findOne({ walletAddress, userId });
    if (!wallet) {
      wallet = new WalletModel({
        userId,
        walletAddress,
        chainType,
        connectedAt: new Date(),
        isConnected: true,
        isCustodial: false, // External wallet
      });
    } else {
      wallet.isConnected = true;
      wallet.connectedAt = new Date();
    }

    await wallet.save();

    // Update User model with connected wallet address
    await User.findByIdAndUpdate(userId, {
      connectedWalletAddress: walletAddress,
      walletType: "custom", // External wallet type
      custodialWallet: null, // Clear any custodial wallet data
      updatedAt: new Date(),
    });

    console.log("[WalletService] External wallet connected:", walletAddress);
    return wallet;
  } catch (error) {
    console.error("[WalletService] Error connecting wallet:", error);
    throw error;
  }
}

export async function disconnectWallet(userId, walletAddress) {
  try {
    const wallet = await WalletModel.findOneAndUpdate(
      { userId, walletAddress },
      { isConnected: false, disconnectedAt: new Date() },
      { new: true }
    );

    // Clear connected wallet from User model if this was the connected one
    const user = await User.findById(userId);
    if (user && user.connectedWalletAddress === walletAddress) {
      await User.findByIdAndUpdate(userId, {
        connectedWalletAddress: null,
        updatedAt: new Date(),
      });
    }

    console.log("[WalletService] Wallet disconnected:", walletAddress);
    return wallet;
  } catch (error) {
    console.error("[WalletService] Error disconnecting wallet:", error);
    throw error;
  }
}

export async function getConnectedWallet(userId) {
  try {
    const wallet = await WalletModel.findOne({ userId, isConnected: true });
    if (!wallet) {
      console.log("[WalletService] No connected wallet found for user:", userId);
      throw new Error("No connected wallet found for user");
    }
    console.log("[WalletService] Connected wallet found:", wallet);
    return wallet;
  } catch (error) {
    console.error("[WalletService] Error fetching wallet:", error);
    return null;
  }
}

export async function getAllWallets(userId) {
  try {
    return await WalletModel.find({ userId }).sort({ connectedAt: -1 });
  } catch (error) {
    console.error("[WalletService] Error fetching wallets:", error);
    return [];
  }
}

export async function updateWalletLastUsed(walletId) {
  try {
    await WalletModel.findByIdAndUpdate(walletId, { lastUsedAt: new Date() });
  } catch (error) {
    console.error("[WalletService] Error updating last used:", error);
  }
}

// Get user's custodial wallet with private key access
export async function getCustodialWallet(userId) {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.custodialWallet?.encryptedKey) {
      throw new Error("No custodial wallet found for user");
    }

    // Decrypt private key
    const privateKey = CryptoJS.AES.decrypt(user.custodialWallet.encryptedKey, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    
    return {
      address: user.custodialWallet.address,
      privateKey: privateKey,
      wallet: new Wallet(privateKey, provider)
    };
  } catch (error) {
    console.error("[WalletService] Error getting custodial wallet:", error);
    throw error;
  }
}

// Check if user has custodial wallet
export async function hasCustodialWallet(userId) {
  try {
    const user = await User.findById(userId);
    return !!(user?.custodialWallet?.encryptedKey);
  } catch (error) {
    console.error("[WalletService] Error checking custodial wallet:", error);
    return false;
  }
}

// Get user's wallet status
export async function getUserWalletStatus(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: "User not found" };
    }

    const connectedWallet = await WalletModel.findOne({ userId, isConnected: true });

    return {
      hasConnectedAddress: !!user.connectedWalletAddress,
      hasCustodialWallet: !!(user.custodialWallet?.encryptedKey),
      walletType: user.walletType,
      connectedAddress: user.connectedWalletAddress,
      custodialAddress: user.custodialWallet?.address,
      canExecuteTransactions: !!(user.custodialWallet?.encryptedKey),
      connectedWallet: connectedWallet
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Fund wallet function (for testnet)
async function fundWalletIfEmpty(targetAddress, minEth = "0.01") {
  try {
    // This would be implemented with your master wallet funding logic
    // For now, just log that funding would happen
    console.log(`[WalletService] Would fund wallet ${targetAddress} with ${minEth} SMR`);
    
    // In a real implementation, you'd have:
    // const masterWallet = new Wallet(process.env.MASTER_PRIVATE_KEY, provider);
    // const tx = await masterWallet.sendTransaction({ to: targetAddress, value: ethers.parseEther(minEth) });
    // return tx.hash;
    
    return { funded: false, message: "Auto-funding not implemented" };
  } catch (error) {
    console.error("[WalletService] Funding error:", error);
    throw error;
  }
}

// Migrate existing user to custodial wallet
export async function migrateToCustodialWallet(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a custodial wallet
    if (user.custodialWallet?.encryptedKey) {
      console.log(`[WalletService] User ${userId} already has a custodial wallet`);
      return user.connectedWalletAddress;
    }

    console.log(`[WalletService] Migrating user ${userId} to custodial wallet...`);
    
    // Create new custodial wallet
    const result = await createUserWallet(userId);
    
    console.log(`[WalletService] Migration complete for user ${userId}: ${result.walletAddress}`);
    return result.walletAddress;
  } catch (error) {
    console.error("[WalletService] Migration failed:", error);
    throw error;
  }
}

export default {
  createUserWallet,
  connectOrCreateCustodialWallet,
  connectWallet,
  disconnectWallet,
  getConnectedWallet,
  getAllWallets,
  updateWalletLastUsed,
  getCustodialWallet,
  hasCustodialWallet,
  getUserWalletStatus,
  migrateToCustodialWallet
};