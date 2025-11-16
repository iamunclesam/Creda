// services/swapService.js
import fetch from "node-fetch";
import CryptoJS from "crypto-js";
import { Wallet as EthersWallet, JsonRpcProvider, Contract, ethers } from "ethers";
import fs from "fs";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { ensureFiatAccount } from "./userService.js";

/**
 * Configuration (IOTA EVM / Shimmer EVM Testnet)
 */
const config = {
  // Fallback RPC endpoints for IOTA EVM (try in order)
  rpcUrls: process.env.RPC_URL 
    ? [process.env.RPC_URL] 
    : [
        "https://json-rpc.evm.testnet.shimmer.network",
        "https://evm.wasp.sc.iota.org",
        "https://json-rpc.evm.shimmer.network",
      ],
  encryptionKey: process.env.PRIVATE_KEY || "test_fallback_encryption_key_32bytes",
  // 0x API endpoints - try multiple formats for IOTA EVM
  zeroXBaseUrls: process.env.ZEROX_API_URL 
    ? [process.env.ZEROX_API_URL]
    : [
        "https://api.0x.org/swap/v1/quote", // Main API with chainId param
      ],
  zeroXApiKey: process.env.ZEROX_API_KEY || null, // Optional API key
  masterPrivateKey: process.env.MASTER_PRIVATE_KEY || null,
  tokens: {
    USDC: process.env.TEST_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
};

// -------------------- PROVIDER & MASTER WALLET --------------------
// IOTA EVM (Shimmer Testnet) chain ID: 1074
// Create provider with first RPC URL, will retry with fallbacks if needed
const IOTA_EVM_CHAIN_ID = 1074;
let provider = new JsonRpcProvider(config.rpcUrls[0], IOTA_EVM_CHAIN_ID, {
  staticNetwork: true,
  batchMaxCount: 1,
});

// Function to get a working provider (tries fallback RPCs if needed)
async function getWorkingProvider() {
  for (const rpcUrl of config.rpcUrls) {
    try {
      const testProvider = new JsonRpcProvider(rpcUrl, IOTA_EVM_CHAIN_ID, {
        staticNetwork: true,
        batchMaxCount: 1,
      });
      // Test the connection by getting the latest block number with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 5000)
      );
      await Promise.race([
        testProvider.getBlockNumber(),
        timeoutPromise
      ]);
      console.log(`[RPC] Using IOTA EVM endpoint: ${rpcUrl}`);
      return testProvider;
    } catch (error) {
      console.warn(`[RPC] Failed to connect to ${rpcUrl}: ${error.message}`);
      continue;
    }
  }
  throw new Error(`All RPC endpoints failed. Tried: ${config.rpcUrls.join(", ")}`);
}

// Initialize provider on startup
let providerInitialized = false;
async function ensureProvider() {
  if (!providerInitialized) {
    try {
      provider = await getWorkingProvider();
      providerInitialized = true;
    } catch (error) {
      console.error("[RPC] Failed to initialize provider:", error.message);
      // Use first RPC as fallback even if test failed
      provider = new JsonRpcProvider(config.rpcUrls[0], IOTA_EVM_CHAIN_ID, {
        staticNetwork: true,
        batchMaxCount: 1,
      });
    }
  }
  return provider;
}

// Helper function to retry provider calls with fallback RPCs
async function withProviderRetry(operation, retries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const currentProvider = await ensureProvider();
      return await operation(currentProvider);
    } catch (error) {
      lastError = error;
      // If it's a server error (like 522), try switching RPC
      if (error.code === 'SERVER_ERROR' || error.code === 'TIMEOUT' || error.info?.responseStatus?.includes('522')) {
        console.warn(`[RPC] Attempt ${attempt + 1} failed, trying next RPC endpoint...`);
        providerInitialized = false; // Force re-initialization with next RPC
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          continue;
        }
      }
      throw error;
    }
  }
  
  throw lastError;
}

// -------------------- ERC20 ABI --------------------
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

/* Master wallet setup: generate if not provided */
let masterWallet;
async function initializeMasterWallet() {
  if (masterWallet) return masterWallet;
  
  const currentProvider = await ensureProvider();
  
  if (config.masterPrivateKey) {
    masterWallet = new EthersWallet(config.masterPrivateKey, currentProvider);
  } else {
    if (fs.existsSync(".master_wallet.json")) {
      const stored = JSON.parse(fs.readFileSync(".master_wallet.json", "utf-8"));
      masterWallet = new EthersWallet(stored.privateKey, currentProvider);
    } else {
      // If no master wallet exists, create a wrapper object for the address
      // This allows the code to work with just an address (read-only mode)
      const masterAddress = "0xc808614261dAa667fB1250192c7c047f76081ef3";
      masterWallet = {
        address: masterAddress,
        // Create a dummy wallet object that throws on sendTransaction
        sendTransaction: async () => {
          throw new Error("Master wallet private key not configured. Cannot send transactions.");
        }
      };
      console.log("Using master wallet address (read-only):", masterAddress);
    }
  }
  return masterWallet;
}

// -------------------- FUNDING SOLUTION --------------------

// Get faucet ETH for master wallet
export async function fundMasterWallet() {
  try {
    const wallet = await initializeMasterWallet();
    const masterAddress = wallet.address;
    const balance = await withProviderRetry(async (p) => await p.getBalance(masterAddress));
    
    console.log(`[Funding] Master wallet ${masterAddress} balance: ${ethers.formatEther(balance)} SMR`);
    
    if (balance > ethers.parseEther("0.01")) {
      console.log(`[Funding] Master wallet already has sufficient funds`);
      return { funded: false, balance: ethers.formatEther(balance) };
    }
    
    console.log(`\n🚨 IMPORTANT: Master wallet needs SMR (Shimmer)! 🚨`);
    console.log(`Please fund this address with IOTA EVM SMR:`);
    console.log(`📬 Address: ${masterAddress}`);
    console.log(`🌐 Use IOTA/Shimmer faucet or bridge:`);
    console.log(`   • Check IOTA community faucets`);
    console.log(`   • Bridge from mainnet via IOTA bridge`);
    console.log(`   • Network: IOTA EVM (Shimmer Testnet)`);
    console.log(`\n💡 Request at least 0.1 SMR for testing\n`);
    
    return { 
      funded: false, 
      balance: ethers.formatEther(balance),
      address: masterAddress,
      message: "Please fund master wallet via faucet" 
    };
  } catch (error) {
    console.error("[Funding] Error checking master wallet:", error);
    throw error;
  }
}

// Enhanced fund wallet function
export async function fundWalletIfEmpty(targetAddress, minEth = "0.01") {
  try {
    const bal = await withProviderRetry(async (p) => await p.getBalance(targetAddress));
    const minBalanceWei = ethers.parseEther(minEth);
    
    console.log(`[Funding] Target ${targetAddress} balance: ${ethers.formatEther(bal)} SMR`);
    
    if (bal >= minBalanceWei) {
      return { funded: false, balance: ethers.formatEther(bal), reason: "Sufficient balance" };
    }
    
    // Check master wallet balance
    const wallet = await initializeMasterWallet();
    const masterBalance = await withProviderRetry(async (p) => await p.getBalance(wallet.address));
    console.log(`[Funding] Master wallet balance: ${ethers.formatEther(masterBalance)} SMR`);
    
    if (masterBalance < minBalanceWei) {
      // Instead of throwing error, provide helpful message
      const result = await fundMasterWallet();
      throw new Error(
        `Master wallet insufficient funds. Need ${minEth} SMR but have ${ethers.formatEther(masterBalance)} SMR.\n` +
        `Please fund master wallet: ${wallet.address}`
      );
    }
    
    // Only send what's needed, not the full minEth
    const sendAmount = minBalanceWei - bal;
    console.log(`[Funding] Sending ${ethers.formatEther(sendAmount)} SMR to ${targetAddress}`);
    
    const tx = await wallet.sendTransaction({ 
      to: targetAddress, 
      value: sendAmount 
    });
    
    console.log(`[Funding] Transaction sent: ${tx.hash}`);
    await tx.wait();
    
    const newBalance = await withProviderRetry(async (p) => await p.getBalance(targetAddress));
    console.log(`[Funding] New balance: ${ethers.formatEther(newBalance)} SMR`);
    
    return { funded: true, txHash: tx.hash, newBalance: ethers.formatEther(newBalance) };
    
  } catch (error) {
    console.error("[Funding] Error:", error.message);
    throw error;
  }
}

// Manual funding function for users
export async function manualFundUserWallet(userId, ethAmount = "0.02") {
  // Note: ethAmount parameter name kept for compatibility, but represents SMR on IOTA EVM
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const walletAddress = user.connectedWalletAddress || user.custodialWallet?.address;
    if (!walletAddress) {
      throw new Error("No wallet address found for user");
    }

    console.log(`[Manual Funding] User ${userId} wallet: ${walletAddress}`);
    
    // Use the enhanced funding function
    return await fundWalletIfEmpty(walletAddress, ethAmount);
  } catch (error) {
    console.error("[Manual Funding] Error:", error);
    throw error;
  }
}

// -------------------- ENHANCED FETCH WITH RETRY LOGIC --------------------
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Fetch] Attempt ${i + 1}/${retries}: ${url}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'SwapBot/1.0',
          'Accept': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.error(`[Fetch] Attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

// -------------------- 0x QUOTE --------------------
async function get0xQuote({ sellToken, buyToken, sellAmount, takerAddress, slippagePercentage = 1.0 }) {
  // Try multiple 0x API endpoints
  let lastError;
  
  for (const baseUrl of config.zeroXBaseUrls) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("sellToken", sellToken);
      url.searchParams.set("buyToken", buyToken);
      
      // Add chainId for main API endpoint (1074 = IOTA EVM / Shimmer Testnet)
      if (baseUrl.includes("api.0x.org/swap")) {
        url.searchParams.set("chainId", String(IOTA_EVM_CHAIN_ID));
      }
      
      if (sellAmount) url.searchParams.set("sellAmount", sellAmount.toString());
      if (takerAddress) url.searchParams.set("takerAddress", takerAddress);
      if (slippagePercentage) url.searchParams.set("slippagePercentage", String(slippagePercentage));
      
      // Add API key if available
      if (config.zeroXApiKey) {
        url.searchParams.set("apiKey", config.zeroXApiKey);
      }

      console.log(`[0x] Fetching quote from: ${url.toString()}`);
      
      const res = await fetchWithRetry(url.toString(), {}, 2, 2000); // Fewer retries per endpoint
      const quote = await res.json();
      
      if (!quote || !quote.to) {
        throw new Error("Invalid quote response from 0x API");
      }
      
      console.log(`[0x] ✅ Quote received successfully`);
      console.log(`[0x] Buy amount: ${quote.buyAmount || 'N/A'}`);
      console.log(`[0x] Estimated gas: ${quote.estimatedGas || 'N/A'}`);
      return quote;
    } catch (error) {
      console.warn(`[0x] Endpoint ${baseUrl} failed: ${error.message}`);
      lastError = error;
      continue; // Try next endpoint
    }
  }
  
  // If all endpoints failed, provide helpful error message
  console.error(`[0x] ❌ All 0x API endpoints failed`);
  throw new Error(
    `0x quote failed: Unable to get quote from any 0x API endpoint.\n` +
    `Last error: ${lastError?.message || 'Unknown error'}\n` +
    `Note: 0x API may not support IOTA EVM testnet publicly.\n` +
    `Consider using a different DEX aggregator or setting ZEROX_API_KEY environment variable.`
  );
}

/* ---------------------------
   Wallet management
   --------------------------- */
export async function createUserWallet(userId) {
  const newWallet = EthersWallet.createRandom();
  const encrypted = CryptoJS.AES.encrypt(newWallet.privateKey, config.encryptionKey).toString();

  await User.findByIdAndUpdate(
    userId,
    { 
      connectedWalletAddress: newWallet.address,
      custodialWallet: {
        address: newWallet.address, 
        encryptedKey: encrypted, 
        createdAt: new Date() 
      },
      walletType: "custodial"
    },
    { upsert: true }
  );

  await Wallet.findOneAndUpdate(
    { userId, walletAddress: newWallet.address },
    {
      userId,
      walletAddress: newWallet.address,
      walletName: "Custodial Wallet",
      isConnected: true,
      chainType: "iota-evm",
      connectedAt: new Date(),
      lastUsedAt: new Date()
    },
    { upsert: true, new: true }
  );

  console.log(`[Wallet] Created custodial wallet for user ${userId}: ${newWallet.address}`);

  // Try to fund, but don't fail if master has no funds
  try {
    const fundResult = await fundWalletIfEmpty(newWallet.address, "0.02");
    if (fundResult.funded) {
      console.log(`[Wallet] Funded ${newWallet.address} with ETH: ${fundResult.txHash}`);
    }
  } catch (e) {
    console.warn("[Wallet] Auto-fund failed (master wallet may need funding):", e.message);
  }

  return newWallet.address;
}

export async function getUserWallet(userId) {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error("User not found");
  }

  if (user.custodialWallet?.encryptedKey) {
    try {
      const pk = CryptoJS.AES.decrypt(user.custodialWallet.encryptedKey, config.encryptionKey).toString(CryptoJS.enc.Utf8);
      const currentProvider = await ensureProvider();
      const wallet = new EthersWallet(pk, currentProvider);
      console.log(`[getUserWallet] Loaded custodial wallet: ${wallet.address}`);
      return wallet;
    } catch (error) {
      console.error(`[getUserWallet] Failed to decrypt private key:`, error);
      throw new Error("Failed to decrypt wallet private key");
    }
  }

  if (user.connectedWalletAddress && (!user.custodialWallet || !user.custodialWallet.encryptedKey)) {
    throw new Error(`User has external wallet ${user.connectedWalletAddress} but no private key access`);
  }

  throw new Error("No accessible wallet found for user");
}

// ------------------ SWAP FUNCTION WITH BETTER FUNDING HANDLING ------------------
export async function swapVia0x({ userId, sellToken, buyToken, sellAmountDecimal, slippagePercentage = 1.0 }) {
  let txRecord;
  
  try {
    console.log(`[Swap] Starting swap for user ${userId}: ${sellAmountDecimal} ${sellToken} -> ${buyToken}`);

    // Get user's wallet
    const wallet = await getUserWallet(userId);
    const walletAddress = wallet.address;
    
    console.log(`[Swap] User wallet: ${walletAddress}`);

    // Check wallet balance first
    console.log(`\n[Swap] Checking wallet balance before swap...`);
    const ethBalance = await getEthBalance(walletAddress);
    console.log(`[Swap] ✅ Balance check complete: ${ethBalance.balance} SMR available\n`);

    // Check if we have enough SMR for the swap
    // If selling SMR, need sellAmount + gas. If selling a token, only need gas (~0.002 SMR)
    const minRequiredForSwap = sellToken === "ETH" || sellToken === "SMR"
      ? parseFloat(sellAmountDecimal) + 0.002  // Selling native token: need amount + gas
      : 0.002;  // Selling token: only need gas
      
    if (parseFloat(ethBalance.balance) < minRequiredForSwap) {
      console.log(`[Swap] Insufficient SMR. Need ~${minRequiredForSwap} SMR but have ${ethBalance.balance} SMR`);
      
      // Try to fund, but handle case where master wallet is empty
      try {
        console.log(`[Swap] Attempting to fund wallet...`);
        const fundResult = await fundWalletIfEmpty(walletAddress, minRequiredForSwap.toString());
        
        if (fundResult.funded) {
          console.log(`[Swap] Successfully funded wallet: ${fundResult.txHash}`);
          // Wait a moment for the funding to be recognized
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (fundError) {
        console.error(`[Swap] Funding failed:`, fundError.message);
        throw new Error(
          `Insufficient SMR for swap and auto-funding failed.\n` +
          `User wallet ${walletAddress} needs at least ${minRequiredForSwap} SMR.\n` +
          `Current balance: ${ethBalance.balance} SMR\n\n` +
          `Please fund the wallet manually or fund the master wallet first.`
        );
      }
    }

    // Determine sell token decimals
    let sellDecimals = 18;
    if (sellToken !== "ETH" && sellToken !== "SMR") {
      const currentProvider = await ensureProvider();
      const tokenContract = new Contract(sellToken, ERC20_ABI, currentProvider);
      sellDecimals = await withProviderRetry(async (p) => {
        const contract = new Contract(sellToken, ERC20_ABI, p);
        return await contract.decimals();
      }).catch(() => 18);
      console.log(`[Swap] ${sellToken} decimals: ${sellDecimals}`);
    }

    const sellAmountBase = ethers.parseUnits(sellAmountDecimal, sellDecimals);
    console.log(`[Swap] Sell amount base units: ${sellAmountBase}`);

    // Fetch 0x quote
    // Map ETH to native token representation for IOTA EVM
    const normalizedSellToken = (sellToken === "ETH" || sellToken === "SMR") ? "ETH" : sellToken;
    const normalizedBuyToken = (buyToken === "ETH" || buyToken === "SMR") ? "ETH" : buyToken;
    const quote = await get0xQuote({
      sellToken: normalizedSellToken,
      buyToken: normalizedBuyToken,
      sellAmount: sellAmountBase.toString(),
      takerAddress: walletAddress,
      slippagePercentage,
    });

    // Save transaction record
    txRecord = new Transaction({
      userId,
      transactionType: "swap",
      fromToken: sellToken,
      toToken: buyToken,
      amount: sellAmountDecimal,
      status: "pending",
      meta: { quote },
    });
    await txRecord.save();

    // Approve ERC20 if needed (skip for native token: ETH or SMR)
    if (sellToken !== "ETH" && sellToken !== "SMR") {
      console.log(`[Swap] Approving ${sellToken}...`);
      await approveIfNeeded(wallet, sellToken, quote.allowanceTarget, sellAmountBase);
    }

    // Execute swap
    const txRequest = {
      to: quote.to,
      data: quote.data,
      value: quote.value ? BigInt(quote.value) : 0n,
      gasLimit: 300000,
    };

    console.log(`[Swap] Sending transaction...`);
    const sentTx = await wallet.sendTransaction(txRequest);
    console.log(`[Swap] Transaction sent: ${sentTx.hash}`);

    const receipt = await sentTx.wait();
    console.log(`[Swap] Transaction mined with status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

    // Update transaction record
    txRecord.status = receipt.status === 1 ? "completed" : "failed";
    txRecord.txHash = sentTx.hash;
    txRecord.receipt = receipt;
    await txRecord.save();

    return { 
      success: receipt.status === 1, 
      txHash: sentTx.hash, 
      receipt, 
      quote, 
      transactionId: txRecord._id 
    };

  } catch (error) {
    console.error("[Swap] Swap failed:", error);
    
    if (txRecord) {
      txRecord.status = "failed";
      txRecord.error = error.message;
      await txRecord.save();
    }
    
    throw error;
  }
}

export async function getEthBalance(address) {
  try {
    console.log(`[Balance Check] Checking native token (SMR) balance for address: ${address}`);
    console.log(`[Balance Check] Network: IOTA EVM (Shimmer Testnet, Chain ID: ${IOTA_EVM_CHAIN_ID})`);
    
    const bal = await withProviderRetry(async (p) => await p.getBalance(address));
    const balanceFormatted = ethers.formatEther(bal);
    
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`💰 SMR BALANCE DETECTED 💰`);
    console.log(`   Address: ${address}`);
    console.log(`   Balance: ${balanceFormatted} SMR`);
    console.log(`   Network: IOTA EVM (Shimmer Testnet)`);
    console.log(`═══════════════════════════════════════════════════════════`);
    
    return { address, balanceRaw: bal.toString(), balance: balanceFormatted };
  } catch (error) {
    console.error(`[getEthBalance] Error:`, error.message);
    throw error;
  }
}

export async function getErc20Balance(address, tokenAddress) {
  if (!tokenAddress) throw new Error("tokenAddress required");
  
  try {
    const currentProvider = await ensureProvider();
    const c = new Contract(tokenAddress, ERC20_ABI, currentProvider);
    const [raw, decimals, symbol] = await Promise.all([
      withProviderRetry(async (p) => {
        const contract = new Contract(tokenAddress, ERC20_ABI, p);
        return await contract.balanceOf(address);
      }),
      withProviderRetry(async (p) => {
        const contract = new Contract(tokenAddress, ERC20_ABI, p);
        return await contract.decimals();
      }).catch(() => 18),
      withProviderRetry(async (p) => {
        const contract = new Contract(tokenAddress, ERC20_ABI, p);
        return await contract.symbol();
      }).catch(() => "TOKEN"),
    ]);
    const readable = ethers.formatUnits(raw, decimals);
    return { address, tokenAddress, symbol, decimals, balanceRaw: raw.toString(), balance: readable };
  } catch (error) {
    console.error(`[getErc20Balance] Error:`, error.message);
    throw error;
  }
}

/**
 * Simulated USD withdrawal (off-ramp)
 * Creates a transaction record and returns a mock status.
 */
export async function withdrawToUSD(userId, amountUSD, fromAddress) {
  try {
    const normalizedAmount = typeof amountUSD === "number" ? amountUSD.toString() : String(amountUSD);
    const txHash = `sim_withdraw_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // Ensure user has a fiat account to receive funds
    const fiatAccount = await ensureFiatAccount(userId);

    const tx = new Transaction({
      userId,
      transactionType: "withdraw",
      token: "USD",
      amount: normalizedAmount,
      valueUSD: normalizedAmount,
      fromWallet: fromAddress,
      txHash,
      status: "completed",
      notes: `Simulated off-ramp to USD → Fiat: ${fiatAccount?.bankName || "IOTA Bank"} ${fiatAccount?.accountNumber || "SIM"}`,
      completedAt: new Date(),
    });
    await tx.save();

    return {
      message: `Withdrawal request submitted for $${normalizedAmount} (simulation).`,
      estimatedTime: "10–15 minutes (simulated)",
      transactionId: txHash,
      fiatAccount: fiatAccount || null,
    };
  } catch (error) {
    console.error("[withdrawToUSD] Error:", error.message);
    throw error;
  }
}

async function approveIfNeeded(wallet, tokenAddress, spender, requiredAmount) {
  if (!tokenAddress || tokenAddress === "ETH" || tokenAddress === "SMR") return;
  
  try {
    const token = new Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await token.allowance(wallet.address, spender).catch(() => 0n);
    
    if (allowance >= BigInt(requiredAmount)) {
      console.log(`[Approve] Allowance sufficient: ${allowance} >= ${requiredAmount}`);
      return;
    }
    
    console.log(`[Approve] Approving ${tokenAddress} for ${requiredAmount}`);
    const tx = await token.approve(spender, requiredAmount);
    console.log(`[Approve] Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log(`[Approve] Approval confirmed`);
  } catch (error) {
    console.error(`[approveIfNeeded] Error:`, error.message);
    throw error;
  }
}


// Check if user has custodial wallet with private key
export async function canUserExecuteTransactions(userId) {
  try {
    const user = await User.findById(userId);
    return !!(user?.custodialWallet?.encryptedKey);
  } catch (error) {
    console.error("[canUserExecuteTransactions] Error:", error);
    return false;
  }
}


// NEW: Check current user's wallet status
export async function getUserWalletStatus(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { error: "User not found" };
    }

    return {
      hasConnectedAddress: !!user.connectedWalletAddress,
      hasCustodialWallet: !!(user.custodialWallet?.encryptedKey),
      walletType: user.walletType,
      connectedAddress: user.connectedWalletAddress,
      custodialAddress: user.custodialWallet?.address,
      canExecuteTransactions: !!(user.custodialWallet?.encryptedKey)
    };
  } catch (error) {
    return { error: error.message };
  }
}



// ... (keep the rest of your existing functions like getEthBalance, approveIfNeeded, etc.)

/* ---------------------------
   Exports
   --------------------------- */
export default {
  createUserWallet,
  getUserWallet,
  fundWalletIfEmpty,
  fundMasterWallet,
  manualFundUserWallet,
  getEthBalance,
  getErc20Balance,
  get0xQuote,
  swapVia0x,
  withdrawToUSD,
  getMasterWalletInfo: async () => {
    const wallet = await initializeMasterWallet();
    return {
      address: wallet.address,
      // This will show the actual balance when called
    };
  },
  canUserExecuteTransactions,
  getUserWalletStatus,
};