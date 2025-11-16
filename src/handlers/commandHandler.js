import * as walletService from "../services/walletService.js";
import * as cryptoService from "../services/cryptoService.js";
import * as transactionService from "../services/transactionService.js";
import * as receiptService from "../services/receiptService.js";
import { getFiatAccount, setFiatAccount } from "../services/userService.js";

export async function executeCommand(userId, phoneNumber, intentData, sock, msg) {
  const { intent, parameters } = intentData;
  const remoteJid = msg.key.remoteJid;

  try {
    switch (intent) {
      case "create_wallet":
        await handleConnectWallet(userId, parameters, sock, remoteJid);
        break;

      case "connect_wallet":
        await handleConnectWallet(userId, parameters, sock, remoteJid);
        break;

      case "fetch_wallet":
      case "fetch_wallet_address":
        await handleFetchWalletAddress(userId, sock, remoteJid);
        break;

         case "swap_token": // NEW — swap tokens via 0x API
        await handleSwapToken(userId, parameters, sock, remoteJid);
        break;

      case "convert_token":
        await handleConvertToken(userId, parameters, sock, remoteJid);
        break;

      case "buy_token":
        await handleBuyToken(userId, parameters, sock, remoteJid);
        break;

      case "send_token":
        await handleSendToken(userId, parameters, sock, remoteJid);
        break;

      case "withdraw_usd":
        await handleWithdrawUSD(userId, parameters, sock, remoteJid);
        break;

      case "connect_bank":
        await handleConnectBank(userId, parameters, sock, remoteJid);
        break;

      case "show_history":
        await handleShowHistory(userId, sock, remoteJid);
        break;

      case "disconnect_wallet":
        await handleDisconnectWallet(userId, parameters, sock, remoteJid);
        break;

      case "check_balance":
        await handleCheckBalance(userId, sock, remoteJid);
        break;

      default:
        await sock.sendMessage(remoteJid, { text: "🤖 Sorry, I didn’t understand that command." });
        break;
    }
  } catch (error) {
    console.error("[CommandHandler] Error executing command:", error);
    await sock.sendMessage(remoteJid, {
      text: `❌ Error executing command: ${error.message}`,
    });
  }
}

async function handleConnectWallet(userId, parameters, sock, remoteJid) {
  const { walletAddress, chainType } = parameters;

  try {
    let wallet;

    if (walletAddress) {
      wallet = await walletService.connectWallet(userId, walletAddress, chainType || "iota-evm");
      await sock.sendMessage(remoteJid, {
        text: `✅ Wallet connected successfully!\n\nAddress: ${walletAddress}\nChain: ${chainType || "IOTA EVM"}`,
      });
    } else {
      const result = await walletService.connectOrCreateCustodialWallet(userId, chainType || "iota-evm");
      await sock.sendMessage(remoteJid, {
        text: `✅ Custodial wallet created successfully!\n\nAddress: ${result.walletAddress}\nChain: ${chainType || "IOTA EVM"}`,
      });
    }
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to connect wallet: ${error.message}`,
    });
  }
}

async function handleFetchWalletAddress(userId, sock, remoteJid) {
  try {
    const wallet = await walletService.getConnectedWallet(userId);

    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "🔎 No wallet found. You can connect or create one using the command: 'connect wallet'.",
      });
      return;
    }

    await sock.sendMessage(remoteJid, {
      text: `💳 Your Wallet Details:\n\nAddress: ${wallet.walletAddress}\nChain: ${wallet.chainType}\nStatus: ${wallet.isConnected ? "Connected" : "Disconnected"}`,
    });
  } catch (error) {
    console.error("[CommandHandler] Error fetching wallet address:", error);
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to fetch wallet details: ${error.message}`,
    });
  }
}

async function handleBuyToken(userId, parameters, sock, remoteJid) {
  const { token, amount } = parameters;

  if (!token || !amount) {
    await sock.sendMessage(remoteJid, {
      text: "Please specify: token (e.g., ETH or HYPE) and amount in USD.",
    });
    return;
  }

  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "No wallet connected. Please connect or create one first.",
      });
      return;
    }

    const result = await cryptoService.buyToken(userId, token, amount, wallet.walletAddress);
    await sock.sendMessage(remoteJid, {
      text: `💰 ${result.message}\n\nEstimated Amount: ${result.estimatedAmount} ${token}\nTransaction ID: ${result.transactionId}`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to buy token: ${error.message}`,
    });
  }
}

async function handleSendToken(userId, parameters, sock, remoteJid) {
  const { token, amount, toAddress } = parameters;

  if (!token || !amount || !toAddress) {
    await sock.sendMessage(remoteJid, {
      text: "Please specify: token, amount, and recipient address.",
    });
    return;
  }

  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "No wallet connected. Please connect or create one first.",
      });
      return;
    }

    const result = await cryptoService.sendToken(userId, wallet.walletAddress, toAddress, token, amount);
    await sock.sendMessage(remoteJid, {
      text: `🚀 ${result.message}\n\nRecipient: ${toAddress}\nTransaction ID: ${result.transactionId}`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to send token: ${error.message}`,
    });
  }
}

async function handleWithdrawUSD(userId, parameters, sock, remoteJid) {
  const { amount } = parameters;

  if (!amount) {
    await sock.sendMessage(remoteJid, {
      text: "Please specify amount in USD (e.g., 1000).",
    });
    return;
  }

  try {
    // Ensure user has connected bank details before proceeding
    const fiat = await getFiatAccount(userId);
    const hasBank = !!(fiat && fiat.bankName && fiat.accountNumber && (fiat.accountName || fiat.holderName) && fiat.status === "active");
    if (!hasBank) {
      await sock.sendMessage(remoteJid, {
        text: '🏦 No bank account linked.\nPlease connect one first using:\n`connect bank: <Bank Name> | <Account Number> | <Holder Name>`',
      });
      return;
    }

    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "No wallet connected. Please connect or create one first.",
      });
      return;
    }

    const result = await cryptoService.withdrawToUSD(userId, amount, wallet.walletAddress);
    await sock.sendMessage(remoteJid, {
      text: `🏧 ${result.message}\n\nEstimated Time: ${result.estimatedTime}\nTransaction ID: ${result.transactionId}`,
    });

    // Generate and send image receipt
    try {
      const receiptBuffer = await receiptService.generateWithdrawalReceipt(userId, {
        amountUSD: amount,
        txHash: result.transactionId,
        walletAddress: wallet.walletAddress,
        fiatAccount: result.fiatAccount,
      });
      await sock.sendMessage(remoteJid, {
        image: receiptBuffer,
        caption: "📄 Withdrawal Receipt",
      });
    } catch (imgErr) {
      console.error("[Receipt] Failed to generate/send receipt:", imgErr.message);
    }
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to withdraw: ${error.message}`,
    });
  }
}

async function handleConnectBank(userId, parameters, sock, remoteJid) {
  const { bankName, accountNumber, holderName } = parameters || {};

  if (!bankName || !accountNumber || !holderName) {
    await sock.sendMessage(remoteJid, {
      text: "Please provide bank details in this format:\n`connect bank: <Bank Name> | <Account Number> | <Holder Name>`",
    });
    return;
  }

  try {
    const fiatAccount = await setFiatAccount(userId, {
      provider: "user",
      bankName,
      accountId: `manual_${userId}`,
      accountName: holderName,
      accountNumber,
      currency: "USD",
      country: "US",
      status: "active",
    });

    await sock.sendMessage(remoteJid, {
      text: `✅ Bank account connected.\nBank: ${fiatAccount.bankName}\nAccount: ••••${String(fiatAccount.accountNumber).slice(-4)}\nHolder: ${fiatAccount.accountName}`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, { text: `❌ Failed to connect bank: ${error.message}` });
  }
}

async function handleShowHistory(userId, sock, remoteJid) {
  try {
    const transactions = await transactionService.getTransactionHistory(userId, 10);

    if (transactions.length === 0) {
      await sock.sendMessage(remoteJid, { text: "📜 No transactions found." });
      return;
    }

    const formattedHistory = await transactionService.formatTransactionHistory(transactions);
    await sock.sendMessage(remoteJid, { text: `📊 Your Transaction History:\n\n${formattedHistory}` });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to fetch history: ${error.message}`,
    });
  }
}

async function handleDisconnectWallet(userId, parameters, sock, remoteJid) {
  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, { text: "No wallet connected." });
      return;
    }

    await walletService.disconnectWallet(userId, wallet.walletAddress);
    await sock.sendMessage(remoteJid, {
      text: `🔒 Wallet disconnected successfully.\nAddress: ${wallet.walletAddress}`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to disconnect wallet: ${error.message}`,
    });
  }
}

async function handleCheckBalance(userId, sock, remoteJid) {
  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "No wallet connected. Please connect or create one first.",
      });
      return;
    }

    const smrBalance = await cryptoService.getEthBalance(wallet.walletAddress);
    // Note: HYPE balance check removed - update as needed for IOTA EVM tokens
    // const hypeBalance = await cryptoService.getBalance(wallet.walletAddress, "HYPE");

    await sock.sendMessage(remoteJid, {
      text: `💼 Your Balances:\n\nSMR: ${smrBalance.balance}\n\n(Additional token balances can be checked individually)`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to fetch balance: ${error.message}`,
    });
  }
}


async function handleConvertToken(userId, parameters, sock, remoteJid) {
  const { token, amount } = parameters;

  if (!token || !amount) {
    await sock.sendMessage(remoteJid, {
      text: "Please specify: token and amount.",
    });
    return;
  }

  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, {
        text: "No wallet connected. Please connect or create one first.",
      });
      return;
    }

    const result = await cryptoService.sendTokenDebridge(userId, wallet.walletAddress, token, amount);
    await sock.sendMessage(remoteJid, {
      text: `🔄 ${result.message}\n\nTransaction ID: ${result.transactionId}`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, {
      text: `❌ Failed to convert token: ${error.message}`,
    });
  }
}


// ================= NEW 0x SWAP HANDLER =================
async function handleSwapToken(userId, parameters, sock, remoteJid) {
  const fromToken = parameters.token;       // Gemini calls it 'token'
  const toToken = parameters.toAddress;     // Gemini calls it 'toAddress'
  const amount = parameters.amount;

  if (!fromToken || !toToken || !amount) {
    await sock.sendMessage(remoteJid, {
      text: "Please specify tokens and amount. Example:\n'swap 0.1 ETH to USDC'",
    });
    return;
  }

  try {
    const wallet = await walletService.getConnectedWallet(userId);
    if (!wallet) {
      await sock.sendMessage(remoteJid, { text: "⚠️ No wallet connected. Use 'connect wallet' first." });
      return;
    }

    await sock.sendMessage(remoteJid, {
      text: `⏳ Swapping ${amount} ${fromToken} → ${toToken}... please wait.`,
    });

    const result = await cryptoService.swapVia0x({
      userId,
      sellToken: fromToken,
      buyToken: toToken,
      sellAmountDecimal: amount,
    });

    await sock.sendMessage(remoteJid, {
      text: `✅ Swap Successful!\n\nFrom: ${fromToken}\nTo: ${toToken}\nAmount: ${amount}\nTx: ${result.txHash}\n\nExplorer: Check IOTA EVM explorer for transaction details`,
    });
  } catch (error) {
    await sock.sendMessage(remoteJid, { text: `❌ Swap failed: ${error.message}` });
  }
}


