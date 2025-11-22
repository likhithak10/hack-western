# Deploy Using Solana Playground (Easiest Solution)

Since you're having issues with `build-sbf`, use Solana Playground to build and deploy your program.

## Step 1: Get Your Program Code

Your program is in: `programs/focus-royale/src/lib.rs`

## Step 2: Go to Solana Playground

1. Visit: **https://beta.solpg.io/**
2. Click **"New"** to create a new project
3. Delete the default code

## Step 3: Paste Your Program

Copy the entire contents of `programs/focus-royale/src/lib.rs` and paste it into Playground.

## Step 4: Build

1. Click **"Build"** button (top right)
2. Wait for compilation to complete
3. You'll see "Build successful"

## Step 5: Deploy

1. Click **"Deploy"** button
2. Connect your wallet (Phantom/Solflare)
3. Make sure wallet is on **Devnet**
4. Confirm the transaction
5. **Copy the Program ID** that appears

## Step 6: Update Your Frontend

Update the Program ID in these files:

### 1. `services/solanaService.ts` (line 7)
```typescript
export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_FROM_PLAYGROUND');
```

### 2. `idl/focus_royale.ts`

In Playground, after building:
1. Click on the **"IDL"** tab
2. Copy the entire IDL JSON
3. Replace the contents of `idl/focus_royale.ts` with:
```typescript
export const IDL = {
  // Paste the IDL JSON here
};
```

### 3. `programs/focus-royale/src/lib.rs` (line 4)
```rust
declare_id!("YOUR_PROGRAM_ID_FROM_PLAYGROUND");
```

### 4. `Anchor.toml` (line 9)
```toml
focus_royale = "YOUR_PROGRAM_ID_FROM_PLAYGROUND"
```

## Step 7: Test Your Frontend

```bash
npm run dev
```

Visit `http://localhost:3000` and test the wallet connection!

## Alternative: Get IDL from Playground

After building in Playground:
1. Click **"IDL"** tab
2. Copy the JSON
3. Save it as `idl/focus_royale.json`
4. Your TypeScript IDL file should import from this

## Benefits of Playground

- ✅ No local build tools needed
- ✅ Works in browser
- ✅ Automatic IDL generation
- ✅ Easy deployment
- ✅ No SSL/network issues

## Your Generated Program ID

From `anchor keys list`, your program keypair is:
```
focus_royale: iFoyAuSWTCs7jDjVApWuevcXfW6FALmo4Z5onAu2mqh
```

**Note**: This is the keypair address. After deployment, the actual program ID might be different, so use the one from Playground after deployment.

