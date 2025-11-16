# WhatsApp IOTA Bot

A Node.js WhatsApp bot powered by AI for on-ramp and off-ramp transactions on IOTA EVM (ShimmerEVM), directly through WhatsApp.

## Features

- **Connect Wallet**: Link your IOTA EVM wallet to the bot
- **Buy Tokens**: Purchase IOTA or IOTA EVM tokens with USD
- **Send Tokens**: Transfer IOTA EVM tokens to other wallet addresses
- **Withdraw to USD**: Convert IOTA EVM assets to USD and withdraw
- **View Transaction History**: Check all your past transactions
- **Disconnect Wallet**: Safely disconnect your wallet
- **Check Balance**: View your current IOTA EVM balances

## Technologies

- **WhatsApp Integration**: Baileys (@whiskeysockets/baileys)
- **AI Assistant**: AI assistant integration
- **Database**: MongoDB
- **Token Swaps**: IOTA EVM DEX integration (e.g., ShimmerEVM DEX)
- **Blockchain**: IOTA EVM (ShimmerEVM)

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

- "Connect wallet 0x123..." - Link your IOTA EVM wallet
- "Buy 100 USD of IOTA" - Purchase IOTA
- "Send 0.5 IOTA to 0x456..." - Transfer IOTA EVM tokens
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
Integrate an IOTA EVM DEX in `src/services/cryptoService.js` for real token swaps (e.g., ShimmerEVM DEX)

### IOTA EVM (On-chain)
Use IOTA EVM (ShimmerEVM) RPC endpoints for on-chain interactions

### Web3
Use ethers.js to interact with IOTA EVM for real transactions

### Payment Processor
Integrate a payment processor for USD withdrawals in `withdrawToUSD()` function

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
