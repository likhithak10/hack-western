# How to Get Your Deployed Program ID

Since you deployed via Solana Playground, here's how to get your program ID:

## Method 1: From Solana Playground

1. In Solana Playground, look at the deployment output
2. You should see a line like:
   ```
   Program Id: YOUR_PROGRAM_ID_HERE
   ```
3. Copy that program ID

## Method 2: Check Solana Playground UI

1. In Solana Playground, look at the left sidebar
2. Find your program file (usually `src/lib.rs`)
3. The program ID should be displayed near the file name or in the program info panel

## Method 3: Use Solana CLI (if you have it)

```bash
solana program show --programs --url devnet
```

This will list all your deployed programs.

## Method 4: Check the Deploy Output

Look back at your terminal output. After "Deployment successful", there should be a program ID shown.

---

## Once You Have the Program ID:

### Step 1: Update `programs/focus-royale/src/lib.rs`

Change line 4:
```rust
declare_id!("YOUR_ACTUAL_PROGRAM_ID_HERE");
```

### Step 2: Update `services/solanaService.ts`

Change line 7:
```typescript
export const PROGRAM_ID = new PublicKey('YOUR_ACTUAL_PROGRAM_ID_HERE');
```

### Step 3: Rebuild Everything

```bash
# Rebuild the Solana program (if using Anchor locally)
anchor build

# Rebuild the frontend
npm run build
```

### Step 4: Test

Restart your dev server and test the Solana features!

---

**Note**: If you can't find the program ID, you can also check the Solana Explorer:
- Go to https://explorer.solana.com/?cluster=devnet
- Search for your wallet address
- Look at "Programs" section to see deployed programs

