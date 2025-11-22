# How to Update Program ID After Deployment

## Step 1: Deploy the Program

When you run:
```bash
anchor deploy --provider.cluster devnet
```

Anchor will output something like:
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: YOUR_WALLET_ADDRESS
Deploying program "focus-royale"...
Program Id: **YOUR_PROGRAM_ID_WILL_BE_HERE**
```

## Step 2: Copy the Program ID

The Program ID will look something like:
```
7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

## Step 3: Update These Files

### File 1: `services/solanaService.ts` (Line 7)

**Current:**
```typescript
export const PROGRAM_ID = new PublicKey('Focu5Royale111111111111111111111111111');
```

**Update to:**
```typescript
export const PROGRAM_ID = new PublicKey('YOUR_ACTUAL_PROGRAM_ID_HERE');
```

### File 2: `programs/focus-royale/src/lib.rs` (Line 3)

**Current:**
```rust
declare_id!("Focu5Royale111111111111111111111111111");
```

**Update to:**
```rust
declare_id!("YOUR_ACTUAL_PROGRAM_ID_HERE");
```

### File 3: `Anchor.toml` (under `[programs.localnet]`)

**Current:**
```toml
[programs.localnet]
focus_royale = "Focu5Royale111111111111111111111111111"
```

**Update to:**
```toml
[programs.localnet]
focus_royale = "YOUR_ACTUAL_PROGRAM_ID_HERE"
```

## Alternative: Find Program ID After Deployment

If you missed the deployment output, you can find it:

### Method 1: Check Anchor.toml
After deployment, Anchor automatically updates `Anchor.toml`:
```bash
cat Anchor.toml | grep "focus_royale"
```

### Method 2: Check target/deploy/
```bash
cat target/deploy/focus_royale-keypair.json
# Or check the .so file location
ls -la target/deploy/focus_royale.so
```

### Method 3: Use Solana CLI
```bash
solana program show YOUR_WALLET_ADDRESS --url devnet
```

## Important Notes

1. **All three files must match** - The program ID must be the same in:
   - `services/solanaService.ts`
   - `programs/focus-royale/src/lib.rs`
   - `Anchor.toml`

2. **Rebuild after updating** - After updating the program ID in Rust:
   ```bash
   anchor build
   ```

3. **Redeploy** - You may need to redeploy:
   ```bash
   anchor deploy --provider.cluster devnet
   ```

## Example

If your program ID is `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`:

**services/solanaService.ts:**
```typescript
export const PROGRAM_ID = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
```

**programs/focus-royale/src/lib.rs:**
```rust
declare_id!("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
```

**Anchor.toml:**
```toml
[programs.localnet]
focus_royale = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
```

