# Next Steps - Complete Setup Guide

## ✅ What You've Completed

1. ✅ Installed Anchor CLI (v0.32.1)
2. ✅ Installed Solana CLI (v1.18.20)
3. ✅ Created Solana keypair
4. ✅ Configured for Devnet
5. ✅ Fixed Anchor.toml configuration

## 🔧 Remaining Steps

### Step 1: Install Solana Platform Tools

The `build-sbf` command is needed. Install it:

```bash
# Option 1: If using Homebrew Solana
brew install solana-platform-tools

# Option 2: Install via Solana installer
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify build-sbf is available
cargo-build-sbf --version
```

### Step 2: Update Frontend Anchor Package

```bash
npm install @coral-xyz/anchor@0.32.1
# or
yarn upgrade @coral-xyz/anchor@0.32.1
```

### Step 3: Get Test SOL

```bash
# Try airdrop (may need to wait if rate limited)
solana airdrop 2

# Or try smaller amounts
solana airdrop 1
solana airdrop 0.5

# Check balance
solana balance
```

### Step 4: Build the Program

```bash
anchor build
```

This will:
- Compile the Rust program
- Generate IDL file in `target/idl/`
- Create program binary in `target/deploy/`

### Step 5: Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

**Important**: After deployment, you'll see output like:
```
Program Id: YOUR_ACTUAL_PROGRAM_ID_HERE
```

### Step 6: Update Program ID

Copy the Program ID from deployment and update in 3 files:

1. **`services/solanaService.ts`** (line 7):
   ```typescript
   export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
   ```

2. **`programs/focus-royale/src/lib.rs`** (line 4):
   ```rust
   declare_id!("YOUR_PROGRAM_ID_HERE");
   ```

3. **`Anchor.toml`** (line 9):
   ```toml
   focus_royale = "YOUR_PROGRAM_ID_HERE"
   ```

### Step 7: Rebuild After Program ID Update

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Step 8: Update IDL in Frontend

Copy the generated IDL:
```bash
# The IDL is generated in target/idl/focus_royale.json
# Update idl/focus_royale.ts with the new IDL if needed
```

### Step 9: Run Frontend

```bash
npm install  # Install all dependencies including Solana packages
npm run dev
```

### Step 10: Test the Application

1. Open `http://localhost:3000`
2. Connect Phantom/Solflare wallet
3. Make sure wallet is on Devnet
4. Try staking some SOL
5. Test the focus session

## 🐛 Troubleshooting

### If `build-sbf` is still missing:

```bash
# Install Solana via official installer (not Homebrew)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH permanently
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### If airdrop fails:

- Wait a few minutes and try again
- Use Solana Faucet: https://faucet.solana.com/
- Try smaller amounts: `solana airdrop 0.5`

### If deployment fails:

- Check you have enough SOL: `solana balance`
- Verify program ID matches in all files
- Try: `anchor clean && anchor build`

## 📝 Quick Command Reference

```bash
# Check Solana config
solana config get

# Check balance
solana balance

# Get SOL
solana airdrop 2

# Build program
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# View program
solana program show YOUR_PROGRAM_ID --url devnet

# Run frontend
npm run dev
```

## 🎯 Current Status

- ✅ Anchor installed
- ✅ Solana CLI installed  
- ✅ Keypair created
- ✅ Devnet configured
- ⏳ Need: Platform tools (`build-sbf`)
- ⏳ Need: Test SOL
- ⏳ Need: Build & deploy
- ⏳ Need: Update program ID
- ⏳ Need: Test frontend

Once you install the platform tools and get SOL, you can proceed with building and deploying!

