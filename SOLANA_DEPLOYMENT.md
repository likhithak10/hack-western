# Solana Program Deployment Guide

## Overview

This guide will help you deploy the Focus Royale Solana program and test it on Devnet.

## Prerequisites

1. **Install Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Install Anchor**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

3. **Install Rust** (if not already installed)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

## Project Structure

```
/programs/focus-royale/
  ├── src/
  │   └── lib.rs          # Main program code
  └── Cargo.toml          # Rust dependencies

/Anchor.toml               # Anchor configuration
/idl/                      # IDL files (generated)
```

## Deployment Steps

### 1. Build the Program

```bash
# From project root
anchor build
```

This will:
- Compile the Rust program
- Generate the IDL file
- Create the program binary

### 2. Get a Devnet Wallet

```bash
# Generate a new keypair (if you don't have one)
solana-keygen new

# Set Solana CLI to use Devnet
solana config set --url devnet

# Airdrop SOL for deployment fees
solana airdrop 2
```

### 3. Update Program ID

The program ID is defined in:
- `programs/focus-royale/src/lib.rs` (line 3)
- `Anchor.toml` (programs.localnet section)

**Important**: After first deployment, you'll get a new program ID. Update both files with the actual deployed program ID.

### 4. Deploy to Devnet

```bash
# Deploy the program
anchor deploy --provider.cluster devnet

# Or use Solana CLI directly
solana program deploy target/deploy/focus_royale.so --url devnet
```

### 5. Update Frontend Program ID

After deployment, update the program ID in:
- `services/solanaService.ts` - Update `PROGRAM_ID` constant
- `idl/focus_royale.ts` - This will be auto-generated, but verify it matches

## Testing Locally

### Option 1: Using Anchor Tests

Create a test file: `tests/focus-royale.ts`

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { FocusRoyale } from "../target/types/focus_royale";
import { expect } from "chai";

describe("focus-royale", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.FocusRoyale as Program<FocusRoyale>;

  it("Initializes escrow", async () => {
    const user = provider.wallet;
    const [escrowPDA] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), user.publicKey.toBuffer()],
      program.programId
    );

    const stakeAmount = new anchor.BN(100000000); // 0.1 SOL

    await program.methods
      .initializeEscrow(stakeAmount)
      .accounts({
        escrow: escrowPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPDA);
    expect(escrow.user.toString()).to.equal(user.publicKey.toString());
    expect(escrow.stakeAmount.toNumber()).to.equal(stakeAmount.toNumber());
  });
});
```

Run tests:
```bash
anchor test --skip-local-validator
```

### Option 2: Using Solana Playground

1. Go to https://beta.solpg.io/
2. Create a new project
3. Copy the program code from `programs/focus-royale/src/lib.rs`
4. Build and deploy directly from the browser

## Frontend Integration

### 1. Install Dependencies

```bash
npm install
```

### 2. Update RPC Endpoint (Optional)

In `services/solanaService.ts`, you can change the RPC endpoint:

```typescript
// For Devnet (default)
const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// For Mainnet (production)
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// For custom RPC (e.g., Helius, QuickNode)
const RPC_ENDPOINT = 'https://your-custom-rpc-url.com';
```

### 3. Run Frontend

```bash
npm run dev
```

## Program Instructions Explained

### 1. `initializeEscrow`
- Creates a new escrow PDA account for a user
- PDA seeds: `["escrow", user_pubkey]`
- Stores initial stake amount and user pubkey

### 2. `depositStake`
- Transfers SOL from user wallet to escrow PDA
- Uses `system_program::transfer`
- Validates user signature

### 3. `updateFocusScore`
- Updates the focus score in escrow account
- Can be called multiple times
- Only updates if new score is higher

### 4. `completeSession`
- Marks the session as completed
- Required before claiming reward

### 5. `claimReward`
- Transfers stake back to user
- Adds bonus from penalty pool (50% of pool)
- Only works if `completed = true`

### 6. `forfeitStake`
- Sends all escrowed SOL to penalty pool
- Called when user quits early

## PDA Derivation

### Escrow PDA
```typescript
const [escrowPDA, bump] = await PublicKey.findProgramAddressSync(
  [Buffer.from("escrow"), userPubkey.toBuffer()],
  programId
);
```

### Penalty Pool PDA
```typescript
const [penaltyPoolPDA, bump] = await PublicKey.findProgramAddressSync(
  [Buffer.from("penalty_pool")],
  programId
);
```

## Transaction Flow Example

```typescript
// 1. User connects wallet
const wallet = useWallet();

// 2. Initialize escrow (first time only)
await solanaService.initializeEscrow(wallet, 0.1 * 1e9);

// 3. Deposit stake
await solanaService.depositStake(wallet, 0.1 * 1e9);

// 4. Update focus score (during session)
await solanaService.updateFocusScore(wallet, 1500);

// 5. Complete session
await solanaService.completeSession(wallet);

// 6. Claim reward (if winner)
await solanaService.claimReward(wallet);
```

## Troubleshooting

### Common Issues

1. **"Program account not found"**
   - Make sure program is deployed
   - Check program ID matches in all files

2. **"Insufficient funds"**
   - Airdrop more SOL: `solana airdrop 2`
   - Check wallet balance

3. **"Account not initialized"**
   - Call `initializeEscrow` before `depositStake`

4. **"Transaction simulation failed"**
   - Check all accounts are correct
   - Verify PDA derivation
   - Ensure sufficient SOL for fees

### Getting Help

- Solana Docs: https://docs.solana.com/
- Anchor Book: https://www.anchor-lang.com/
- Solana Discord: https://discord.gg/solana

## Security Considerations

1. **Always validate user signatures** ✅ (Done in program)
2. **Check account ownership** ✅ (Done via PDA seeds)
3. **Validate amounts** ✅ (Program checks stake amounts)
4. **Handle errors gracefully** ✅ (Custom error codes)

## Next Steps

1. Deploy to Devnet
2. Test all instructions
3. Update frontend with deployed program ID
4. Test end-to-end flow
5. Deploy to Mainnet (when ready)

## Program ID

After deployment, your program ID will be displayed. Update it in:
- `programs/focus-royale/src/lib.rs`
- `Anchor.toml`
- `services/solanaService.ts`

