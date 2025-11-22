# Quick Start Guide - Focus Royale with Solana

## 🚀 Getting Started

### Step 1: Install Dependencies

```bash
npm install
```

This will install:
- React and Vite
- Solana Web3.js and Anchor
- Wallet adapters (Phantom, Solflare)
- All other dependencies

### Step 2: Set Up Solana Environment

```bash
# Install Solana CLI (if not installed)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor (if not installed)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Set to Devnet
solana config set --url devnet

# Get some test SOL
solana airdrop 2
```

### Step 3: Build and Deploy Solana Program

```bash
# Build the program
anchor build

# Deploy to Devnet
anchor deploy --provider.cluster devnet
```

**Important**: After deployment, copy the program ID and update it in:
- `services/solanaService.ts` (line 7)
- `programs/focus-royale/src/lib.rs` (line 3)
- `Anchor.toml` (programs.localnet section)

### Step 4: Generate IDL (if needed)

After building, the IDL should be in `target/idl/focus_royale.json`. 

If you need to update the TypeScript IDL:
```bash
# Copy from target/idl/focus_royale.json to idl/focus_royale.ts
# Or use anchor to generate it
```

### Step 5: Run the Frontend

```bash
npm run dev
```

Visit `http://localhost:3000`

## 🎮 How to Play

1. **Connect Wallet**: Click "Connect Wallet" and select Phantom or Solflare
2. **Join Lobby**: Click "JOIN LOBBY"
3. **Stake SOL**: Enter amount (e.g., 0.1 SOL) and click "LOCK IN & START"
4. **Focus Session**: 
   - Work in the text editor
   - Keep your camera on (for biometric tracking)
   - Maintain focus to increase your score
5. **End Session**: Click "END SESSION" when done
6. **Claim Reward**: If you have the highest score, click "CLAIM REWARD"

## 🔧 Troubleshooting

### Wallet Not Connecting
- Make sure Phantom/Solflare extension is installed
- Check browser console for errors
- Try refreshing the page

### Transaction Fails
- Check you have enough SOL for fees
- Verify program is deployed
- Check program ID matches in all files

### Program Not Found
- Make sure program is deployed: `anchor deploy --provider.cluster devnet`
- Verify program ID in `services/solanaService.ts`
- Check RPC endpoint is correct

### Build Errors
- Make sure Rust is installed: `rustc --version`
- Install Anchor: `avm install latest`
- Try: `anchor clean && anchor build`

## 📝 Key Files

- `programs/focus-royale/src/lib.rs` - Solana program (Rust)
- `services/solanaService.ts` - Frontend Solana integration
- `components/WalletProvider.tsx` - Wallet connection setup
- `App.tsx` - Main game logic with Solana integration
- `idl/focus_royale.ts` - Program interface definition

## 🎯 Next Steps

1. Test on Devnet
2. Customize focus score calculation
3. Add more features (leaderboard, NFTs, etc.)
4. Deploy to Mainnet (when ready)

For detailed deployment instructions, see `SOLANA_DEPLOYMENT.md`

