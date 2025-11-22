# Setup Guide - Running on a New Computer

This guide will help you set up and run Focus Royale on a different computer.

## Prerequisites

### 1. Install Node.js
- **Download**: [nodejs.org](https://nodejs.org/)
- **Version**: v18 or higher (v20 recommended)
- **Verify installation**:
  ```bash
  node --version
  npm --version
  ```

### 2. Install Git (if cloning from repository)
- **Download**: [git-scm.com](https://git-scm.com/)
- **Verify installation**:
  ```bash
  git --version
  ```

## Step-by-Step Setup

### Step 1: Get the Code

**Option A: Clone from Git Repository**
```bash
git clone <repository-url>
cd hack-western-2
```

**Option B: Copy the Project Folder**
- Copy the entire `hack-western-2` folder to the new computer
- Navigate to it:
  ```bash
  cd hack-western-2
  ```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages (React, Vite, Solana, Gemini, etc.)

**Note**: This may take a few minutes the first time.

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory:

**On Windows:**
```bash
# In Command Prompt or PowerShell
echo GEMINI_API_KEY=your_api_key_here > .env
```

**On Mac/Linux:**
```bash
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

**Or manually create `.env` file:**
1. Create a new file named `.env` in the root directory
2. Add this line:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. Replace `your_api_key_here` with your actual Gemini API key

**How to get a Gemini API Key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it in your `.env` file

### Step 4: Run the Application

```bash
npm run dev
```

You should see output like:
```
  VITE v6.4.1  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 5: Open in Browser

Open your browser and go to:
```
http://localhost:3000
```

## Optional: Backend Server Setup

If you want to use the backend server for advanced features:

### Step 1: Navigate to Backend Folder
```bash
cd backend
```

### Step 2: Install Backend Dependencies
```bash
npm install
```

### Step 3: Create Backend Environment File
Create `backend/.env`:
```bash
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000
SMART_SPECTRA_MODE=pipeline
# Add other backend config as needed
```

### Step 4: Run Backend Server
```bash
npm start
```

The backend will run on `http://localhost:3001`

**Note**: The frontend will work without the backend - it will use local/mock processing instead.

## Optional: Solana Setup

If you want to use Solana features:

### 1. Install Solana CLI
```bash
# Mac/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Windows
# Download from: https://github.com/solana-labs/solana/releases
```

### 2. Install Anchor
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 3. Set Up Solana Wallet
```bash
solana-keygen new
solana config set --url devnet
solana airdrop 2
```

## Troubleshooting

### "npm: command not found"
- Node.js is not installed or not in PATH
- Reinstall Node.js and restart terminal

### "Cannot find module" errors
- Dependencies not installed
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

### "Port 3000 already in use"
- Another app is using port 3000
- Kill the process or change port in `vite.config.ts`

### "GEMINI_API_KEY is not defined"
- `.env` file is missing or incorrectly formatted
- Make sure `.env` is in the root directory
- Check that the file has no extra spaces or quotes
- Restart the dev server after creating `.env`

### Camera not working
- Grant camera permissions in browser
- Make sure you're using HTTPS or localhost (required for camera)
- Check browser console for errors

### Build errors
- Check Node.js version: `node --version` (should be v18+)
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check for TypeScript errors

## Quick Setup Checklist

- [ ] Node.js installed (v18+)
- [ ] Git installed (if cloning)
- [ ] Project folder on computer
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with `GEMINI_API_KEY`
- [ ] Dev server running (`npm run dev`)
- [ ] Browser opened to `http://localhost:3000`
- [ ] Camera permissions granted

## What Gets Installed

When you run `npm install`, these main packages are installed:
- **React** - UI framework
- **Vite** - Build tool and dev server
- **Solana Web3.js** - Solana blockchain integration
- **Google GenAI** - Gemini API client
- **Socket.io** - WebSocket client (for backend)
- **Lucide React** - Icons

## File Structure Overview

```
hack-western-2/
├── .env                 # Environment variables (YOU CREATE THIS)
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
├── index.html           # Main HTML file
├── index.tsx            # Entry point
├── App.tsx              # Main app component
├── services/            # API services
│   ├── geminiService.ts # Gemini API calls
│   ├── solanaService.ts # Solana integration
│   └── ...
├── components/          # React components
└── dist/               # Built files (after npm run build)
```

## Running in Production Mode

To build for production:
```bash
npm run build
```

This creates optimized files in the `dist/` folder that can be served by any web server.

## Need Help?

- Check the console for error messages
- Verify all prerequisites are installed
- Make sure `.env` file is correctly formatted
- Check that ports 3000 (and 3001 if using backend) are available

---

**You're all set! 🚀**

