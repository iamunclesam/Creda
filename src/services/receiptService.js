import { createCanvas, loadImage, registerFont } from 'canvas';
import User from "../models/User.js";

function drawMultiline(ctx, text, x, y, maxWidth, lineHeight, color = '#333333', fontSize = 14, isBold = false) {
  ctx.fillStyle = color;
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
  
  const words = text.split(' ');
  let line = '';
  let cursorY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, cursorY);
      line = words[n] + ' ';
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

function maskAccountNumber(accountNumber) {
  if (!accountNumber) return "—";
  const str = String(accountNumber);
  const last4 = str.slice(-4);
  return `•••• ${last4}`;
}

function formatDate() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    time: now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  };
}

export async function generateWithdrawalReceipt(userId, { amountUSD, txHash, walletAddress, fiatAccount }) {
  try {
    const width = 400; // Narrower like mobile receipts
    const height = 700;
    const margin = 25;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Colors - OPay style
    const colors = {
      primary: '#1E40AF', // Blue instead of green
      success: '#10B981',
      background: '#FFFFFF',
      headerBg: '#F8FAFC',
      textDark: '#1F2937',
      textLight: '#6B7280',
      border: '#E5E7EB',
      accent: '#3B82F6'
    };

    // Background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Header with gradient background
    const headerHeight = 120;
    const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, '#3730A3');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, headerHeight);

    // App icon/logo area (circle)
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.arc(width / 2, 50, 30, 0, Math.PI * 2);
    ctx.fill();

    // App name
    ctx.fillStyle = colors.background;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CREDA.ai', width / 2, 100);

    // Transaction type
    ctx.font = '14px sans-serif';
    ctx.fillText('Withdrawal', width / 2, 120);

    // Main content area
    let cursorY = headerHeight + 30;

    // Amount section
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.textDark;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`$${parseFloat(amountUSD).toLocaleString()}`, width / 2, cursorY);

    cursorY += 40;

    // Status badge
    ctx.fillStyle = colors.success;
    ctx.beginPath();
    ctx.roundRect(width / 2 - 40, cursorY, 80, 25, 12);
    ctx.fill();

    ctx.fillStyle = colors.background;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMPLETED', width / 2, cursorY + 16);

    cursorY += 50;

    // Transaction details card
    const cardWidth = width - (margin * 2);
    const cardX = margin;

    // Card background
    ctx.fillStyle = colors.headerBg;
    ctx.beginPath();
    ctx.roundRect(cardX, cursorY, cardWidth, 200, 12);
    ctx.fill();

    // Card content
    ctx.textAlign = 'left';
    let contentY = cursorY + 25;

    // Date and time
    const { date, time } = formatDate();
    contentY = drawMultiline(ctx, 'Date & Time', cardX + 20, contentY, 150, 20, colors.textLight, 12);
    contentY = drawMultiline(ctx, `${date} at ${time}`, cardX + 20, contentY, 250, 20, colors.textDark, 13, true);
    contentY += 10;

    // Transaction ID
    contentY = drawMultiline(ctx, 'Transaction ID', cardX + 20, contentY, 150, 20, colors.textLight, 12);
    const shortTxHash = txHash ? `${txHash.substring(0, 12)}...${txHash.substring(txHash.length - 8)}` : '—';
    contentY = drawMultiline(ctx, shortTxHash, cardX + 20, contentY, 250, 20, colors.textDark, 13, true);
    contentY += 10;

    // From (Wallet)
    contentY = drawMultiline(ctx, 'From', cardX + 20, contentY, 150, 20, colors.textLight, 12);
    const shortWallet = walletAddress ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 6)}` : '—';
    contentY = drawMultiline(ctx, `IOTA Wallet: ${shortWallet}`, cardX + 20, contentY, 250, 20, colors.textDark, 13, true);
    contentY += 10;

    // To (Bank Account)
    if (fiatAccount) {
      contentY = drawMultiline(ctx, 'To', cardX + 20, contentY, 150, 20, colors.textLight, 12);
      contentY = drawMultiline(ctx, 
        `${fiatAccount.bankName || 'Bank'} • ${maskAccountNumber(fiatAccount.accountNumber)}`, 
        cardX + 20, contentY, 250, 20, colors.textDark, 13, true
      );
    }

    cursorY += 220;

    // User information card
    ctx.fillStyle = colors.headerBg;
    ctx.beginPath();
    ctx.roundRect(cardX, cursorY, cardWidth, 120, 12);
    ctx.fill();

    const user = await User.findById(userId).catch(() => null);
    let userY = cursorY + 25;

    ctx.textAlign = 'left';
    userY = drawMultiline(ctx, 'Customer Details', cardX + 20, userY, 200, 20, colors.textLight, 12, true);
    userY += 5;

    userY = drawMultiline(ctx, `Name: ${user?.name || "—"}`, cardX + 20, userY, 300, 18, colors.textDark, 12);
    userY = drawMultiline(ctx, `Phone: ${user?.whatsappPhoneNumber || "—"}`, cardX + 20, userY, 300, 18, colors.textDark, 12);
    userY = drawMultiline(ctx, `Email: ${user?.email || "—"}`, cardX + 20, userY, 300, 18, colors.textDark, 12);

    cursorY += 140;

    // Footer note
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.textLight;
    ctx.font = '10px sans-serif';
    ctx.fillText('This is a simulated receipt for demonstration purposes', width / 2, cursorY);
    
    cursorY += 15;
    ctx.fillText('Powered by IOTA EVM • Shimmer Testnet', width / 2, cursorY);

    // Add rounded corners helper if not available
    if (!ctx.roundRect) {
      ctx.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
      };
    }

    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error("[Receipt] Error generating receipt:", error);
    throw new Error(`Failed to generate receipt: ${error.message}`);
  }
}

export default {
  generateWithdrawalReceipt,
};