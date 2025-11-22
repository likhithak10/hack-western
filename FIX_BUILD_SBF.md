# Fix build-sbf Missing Error

## Problem
You're getting: `error: no such command: 'build-sbf'`

This happens because the Homebrew version of Solana doesn't include the platform tools needed for building programs.

## Solution Options

### Option 1: Install Official Solana Toolchain (Recommended)

The official Solana installer includes `build-sbf`. Try one of these:

**Method A: Direct Download**
```bash
# Download manually if curl fails
# Visit: https://github.com/solana-labs/solana/releases
# Download the latest release for macOS
# Extract and add to PATH
```

**Method B: Use Different Network/VPN**
```bash
# If SSL errors persist, try:
curl -k -sSfL https://release.solana.com/stable/install | sh
```

**Method C: Manual Installation**
1. Download from: https://github.com/solana-labs/solana/releases/tag/v1.18.20
2. Extract the archive
3. Add to PATH:
   ```bash
   export PATH="/path/to/solana/release/bin:$PATH"
   echo 'export PATH="/path/to/solana/release/bin:$PATH"' >> ~/.zshrc
   ```

### Option 2: Use Solana Playground (Easiest for Testing)

Instead of building locally, use Solana Playground:

1. Go to: https://beta.solpg.io/
2. Create new project
3. Copy your program code from `programs/focus-royale/src/lib.rs`
4. Build and deploy directly in browser
5. Get the program ID from there
6. Update your frontend with that program ID

### Option 3: Use Docker (If Available)

```bash
# Run Anchor in Docker
docker run -it --rm -v $(pwd):/workspace -w /workspace projectserum/anchor:latest anchor build
```

### Option 4: Use GitHub Actions / CI

Set up a GitHub Action to build and deploy automatically.

## Quick Workaround: Use Solana Playground

For now, the easiest solution is:

1. **Copy your program code** from `programs/focus-royale/src/lib.rs`
2. **Go to Solana Playground**: https://beta.solpg.io/
3. **Create new project** and paste your code
4. **Build and deploy** - it will give you a program ID
5. **Update your frontend** with that program ID:
   - `services/solanaService.ts` (line 7)
   - `idl/focus_royale.ts` (update with Playground's IDL)

## Verify Installation

After installing, verify:
```bash
which cargo-build-sbf
cargo-build-sbf --version
```

## Current Status

- ✅ Anchor CLI installed (v0.32.1)
- ✅ Solana CLI installed (v1.18.20 via Homebrew)
- ✅ Anchor package updated (v0.32.1)
- ❌ build-sbf missing (needs official Solana toolchain)

## Recommended Next Step

**Use Solana Playground** for now to get your program deployed, then you can fix the local build environment later.

