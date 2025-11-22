# Focus Royale - Solana Integration

## Overview

Focus Royale is a Solana-based "Proof-of-Focus" application where users compete based on their focus scores. The highest focus score wins the staked SOL pool.

## Key Features

- ✅ Solana wallet integration (Phantom, Solflare)
- ✅ On-chain escrow for staked SOL
- ✅ Real-time focus score updates to blockchain
- ✅ Winner-takes-all reward system
- ✅ Penalty pool for forfeited stakes

## How It Works

1. **Connect Wallet**: Users connect their Solana wallet (Phantom/Solflare)
2. **Stake SOL**: Users stake SOL before starting a focus session
3. **Compete**: Focus scores are tracked and updated on-chain
4. **Winner Determination**: Highest focus score wins
5. **Claim Reward**: Winner claims their stake back + bonus from penalty pool

## Architecture

### Solana Program (Rust/Anchor)

Located in `programs/focus-royale/src/lib.rs`

**Instructions:**
- `initializeEscrow` - Create escrow account for user
- `depositStake` - Transfer SOL to escrow
- `updateFocusScore` - Update user's focus score
- `completeSession` - Mark session as completed
- `claimReward` - Winner claims stake + bonus
- `forfeitStake` - Send stake to penalty pool

**PDAs:**
- Escrow: `["escrow", user_pubkey]`
- Penalty Pool: `["penalty_pool"]`

### Frontend Integration

**Services:**
- `services/solanaService.ts` - Solana transaction helpers
- `components/WalletProvider.tsx` - Wallet adapter setup

**Key Functions:**
- Wallet connection via `@solana/wallet-adapter-react`
- Transaction building and signing
- Account fetching and deserialization

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy Solana Program

See `SOLANA_DEPLOYMENT.md` for detailed deployment instructions.

### 3. Update Program ID

After deployment, update `PROGRAM_ID` in:
- `services/solanaService.ts`

### 4. Run Frontend

```bash
npm run dev
```

## Game Flow

### Focus Score Competition

Instead of a fixed time limit, the game uses focus scores:

1. **Session Start**: All players stake SOL and start session
2. **Real-time Updates**: Focus scores update every 5 seconds on-chain
3. **Session End**: After 30 minutes OR when winner is determined
4. **Winner**: Highest focus score wins the entire pot
5. **Reward**: Winner claims stake + 50% of penalty pool

### Focus Score Calculation

Focus scores are calculated based on:
- Biometric data (gaze stability, heart rate)
- Distraction detection (phone, talking, eating, etc.)
- Flow state maintenance
- Work verification (Gemini AI analysis)

## Transaction Examples

### Initialize and Stake

```typescript
// 1. Initialize escrow
await solanaService.initializeEscrow(wallet, 0.1 * 1e9);

// 2. Deposit stake
await solanaService.depositStake(wallet, 0.1 * 1e9);
```

### Update Score During Session

```typescript
// Update focus score (called automatically every 5 seconds)
await solanaService.updateFocusScore(wallet, currentFlowScore);
```

### End Session and Claim

```typescript
// 1. Complete session
await solanaService.completeSession(wallet);

// 2. If winner, claim reward
await solanaService.claimReward(wallet);
```

## Account Structure

### Escrow Account

```rust
pub struct Escrow {
    pub user: Pubkey,           // 32 bytes
    pub stake_amount: u64,      // 8 bytes
    pub focus_score: u64,       // 8 bytes
    pub completed: bool,        // 1 byte
    pub bump: u8,               // 1 byte
}
```

## Error Handling

The program includes custom error codes:
- `UnauthorizedUser` - User doesn't own the escrow
- `SessionNotCompleted` - Can't claim before completing session

## Testing

### Local Testing

1. Start local validator:
```bash
solana-test-validator
```

2. Deploy program:
```bash
anchor deploy
```

3. Run tests:
```bash
anchor test
```

### Devnet Testing

1. Switch to devnet:
```bash
solana config set --url devnet
```

2. Airdrop SOL:
```bash
solana airdrop 2
```

3. Deploy:
```bash
anchor deploy --provider.cluster devnet
```

## Security

- ✅ PDA-based account ownership
- ✅ Signature validation
- ✅ Amount validation
- ✅ State checks before operations

## Future Enhancements

- [ ] Multi-session support
- [ ] Leaderboard on-chain
- [ ] NFT rewards for winners
- [ ] Staking pools
- [ ] Governance token

## Resources

- [Solana Docs](https://docs.solana.com/)
- [Anchor Book](https://www.anchor-lang.com/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

