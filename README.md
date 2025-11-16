# WhatsApp Crypto Bot

A Node.js WhatsApp bot powered by Gemini AI for on-ramp and off-ramp crypto transactions directly through WhatsApp.

## Features

- **Connect Wallet**: Link your Ethereum wallet to the bot
- **Buy Tokens**: Purchase ETH or Hyperliquid tokens with USD
- **Send Tokens**: Transfer tokens to other wallet addresses
- **Withdraw to USD**: Convert crypto to USD and withdraw to your card
- **View Transaction History**: Check all your past transactions
- **Disconnect Wallet**: Safely disconnect your wallet
- **Check Balance**: View your current ETH and Hyperliquid balances

## Technologies

- **WhatsApp Integration**: Baileys (@whiskeysockets/baileys)
- **AI Assistant**: Gemini 2.0 Flash Lite (@google/genai)
- **Database**: MongoDB
- **Token Swaps**: 1inch API (ready to integrate)
- **Blockchain**: Hyperliquid & Ethereum (ready to integrate)

## Installation

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Gemini API Key
- WhatsApp Account

### Setup

1. Clone this repository:
\`\`\`bash
git clone <repository-url>
cd whatsapp-crypto-bot
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Create `.env` file from `.env.example`:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Add your API keys to `.env`:
\`\`\`bash
MONGODB_URI=mongodb://localhost:27017/whatsapp-crypto-bot
GEMINI_API_KEY=your_gemini_key_here
\`\`\`

5. Start the bot:
\`\`\`bash
npm start
\`\`\`

6. Scan the QR code with your WhatsApp phone

## Usage

Once connected, simply message the bot:

- "Connect wallet 0x123..." - Link your wallet
- "Buy 100 USD of ETH" - Purchase ETH
- "Send 0.5 ETH to 0x456..." - Transfer tokens
- "Withdraw 500 USD" - Off-ramp to USD
- "Show my transactions" - View history
- "Disconnect wallet" - Remove wallet connection
- "Check my balance" - View holdings

## Project Structure

\`\`\`
whatsapp-crypto-bot/
├── src/
│   ├── config/
│   │   ├── database.js      # MongoDB setup
│   │   └── gemini.js        # Gemini AI configuration
│   ├── models/
│   │   ├── User.js          # User schema
│   │   ├── Wallet.js        # Wallet schema
│   │   └── Transaction.js   # Transaction schema
│   ├── services/
│   │   ├── userService.js           # User management
│   │   ├── walletService.js         # Wallet operations
│   │   ├── cryptoService.js         # Crypto operations
│   │   └── transactionService.js    # Transaction tracking
│   ├── handlers/
│   │   ├── messageHandler.js  # Message processing
│   │   └── commandHandler.js  # Command execution
│   └── index.js             # Entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
\`\`\`

## Integration Points

### 1inch API (Token Swaps)
Integrate in `src/services/cryptoService.js` for real token swaps

### Hyperliquid API (Perpetuals)
Add support for Hyperliquid trading in `cryptoService.js`

### Ethereum/Web3
Use ethers.js to interact with blockchain for real transactions

### Payment Processor
Integrate Stripe or Circle for USD withdrawals in `withdrawToUSD()` function

## Development

Start dev mode with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| GEMINI_API_KEY | Google Gemini API key | Yes |
| ONEINCH_API_KEY | 1inch API key | No (for trades) |
| HYPERLIQUID_API_KEY | Hyperliquid API key | No (for trading) |
| PAYMENT_PROCESSOR_KEY | Stripe/Circle API key | No (for withdrawals) |

## Security Notes

- WhatsApp session files are stored locally in `auth_info_baileys/`
- Never commit `.env` file or session files to version control
- Use environment variables for all sensitive data
- Implement Row-Level Security (RLS) for MongoDB when in production

## Error Handling

The bot gracefully handles:
- Connection failures with automatic reconnection
- Invalid commands with helpful error messages
- Transaction failures with rollback support
- Invalid wallet addresses

## Contributing

Contributions are welcome! Please follow the existing code structure and add tests for new features.

## License

ISC

## Support

For issues or questions, open an issue on GitHub or contact the development team.
