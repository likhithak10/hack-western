# Deployment Guide for Focus Royale

This guide will help you deploy the Focus Royale application to production.

## Prerequisites

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **Git** (to clone the repository)
   - Verify: `git --version`

3. **A Gemini API Key** (required for focus detection)
   - Get one from [Google AI Studio](https://aistudio.google.com/app/apikey)

4. **(Optional) Solana Wallet** - Only needed if using Solana features
5. **(Optional) Backend Server** - Only needed for advanced biometric features

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd hack-western-2

# Install dependencies
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
# Required: Gemini API Key for focus detection
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Gemini Model (default: gemini-2.0-flash-lite)
GEMINI_MODEL=gemini-2.0-flash-lite

# Optional: Backend server URL (if using backend)
KERNEL_URL=http://localhost:3001

# Optional: Presage API Key (if using backend)
PRESAGE_API_KEY=your_presage_key_here

# Optional: Vision cadence controls (milliseconds)
GEMINI_INTERVAL_DISTRACTED=100
GEMINI_INTERVAL_FOCUS=180

# Optional: Smoothing thresholds (milliseconds)
SMOOTH_EYES_CLOSED_MS=1200
SMOOTH_NO_FACE_MS=400
SMOOTH_OTHER_MS=250
SMOOTH_RECOVERY_MS=200
```

**Important:** The `.env` file should NOT be committed to git. It's already in `.gitignore`.

## Step 3: Build the Application

```bash
npm run build
```

This creates a `dist/` folder with the production-ready files.

## Step 4: Deploy to a Hosting Platform

### Option A: Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (optional, or use web interface):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - Add environment variables in Vercel dashboard:
     - Go to Project Settings → Environment Variables
     - Add `GEMINI_API_KEY` and any other needed variables

3. **Or use Vercel Web Interface**:
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Add environment variables in project settings
   - Deploy!

### Option B: Deploy to Netlify

1. **Install Netlify CLI** (optional):
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod
   ```
   - Or use the Netlify web interface
   - Add environment variables in Site Settings → Environment Variables

3. **Build Settings** (if using web interface):
   - Build command: `npm run build`
   - Publish directory: `dist`

### Option C: Deploy to GitHub Pages

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json**:
   ```json
   {
     "scripts": {
       "deploy": "npm run build && gh-pages -d dist"
     }
   }
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

   **Note:** Environment variables won't work with static hosting. You'll need to use a different approach for API keys (see "Security Note" below).

### Option D: Deploy to Any Static Host

1. Build the app: `npm run build`
2. Upload the `dist/` folder contents to your hosting provider
3. Configure environment variables as per your hosting provider's documentation

## Step 5: Configure Environment Variables in Production

**Important:** For production deployments, you MUST set environment variables in your hosting platform:

### Required:
- `GEMINI_API_KEY` - Your Gemini API key

### Optional:
- `GEMINI_MODEL` - Model to use (default: gemini-2.0-flash-lite)
- `KERNEL_URL` - Backend server URL (if using)
- Other variables as needed

**How to set in different platforms:**
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables
- **Other platforms**: Check their documentation

## Step 6: (Optional) Deploy Backend Server

If you want to use the backend server for advanced features:

1. **Navigate to backend folder**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up backend environment**:
   Create `backend/.env`:
   ```bash
   PORT=3001
   ALLOWED_ORIGIN=https://your-frontend-url.com
   SMART_SPECTRA_MODE=pipeline
   # ... other backend config
   ```

3. **Deploy backend**:
   - Use a Node.js hosting service (Railway, Render, Heroku, etc.)
   - Or deploy to a VPS/server
   - Update `KERNEL_URL` in frontend environment variables

## Step 7: (Optional) Deploy Solana Program

If you want to use Solana features:

1. **Install Solana CLI and Anchor**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

2. **Build and deploy**:
   ```bash
   anchor build
   anchor deploy --provider.cluster devnet
   ```

3. **Update Program ID**:
   - Copy the program ID from deployment output
   - Update in `services/solanaService.ts`
   - Update in `programs/focus-royale/src/lib.rs`
   - Rebuild frontend: `npm run build`

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **API Keys in Frontend**: Since this is a frontend app, the Gemini API key will be visible in the built JavaScript. Consider:
   - Using a backend proxy for API calls (recommended for production)
   - Using environment variables that are injected at build time
   - Implementing rate limiting on your API key
3. **CORS**: If deploying backend, ensure CORS is properly configured for your frontend domain

## Testing the Deployment

After deployment:

1. Visit your deployed URL
2. Connect a Solana wallet (if using Solana features)
3. Grant camera permissions when prompted
4. Click "LOCK IN & START" to begin a session
5. Verify that focus detection is working

## Troubleshooting

### Build Fails
- Check Node.js version: `node --version` (should be v18+)
- Delete `node_modules` and `package-lock.json`, then `npm install` again
- Check for TypeScript errors: `npm run build`

### Environment Variables Not Working
- Ensure variables are set in your hosting platform (not just `.env` file)
- Rebuild after adding environment variables
- Check that variable names match exactly (case-sensitive)

### Camera Not Working
- Ensure HTTPS is enabled (required for camera access)
- Check browser console for errors
- Verify camera permissions are granted

### Gemini API Errors
- Verify `GEMINI_API_KEY` is set correctly
- Check API key has proper permissions
- Check API quota/limits in Google AI Studio

## Quick Deploy Checklist

- [ ] Node.js installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with `GEMINI_API_KEY`
- [ ] App builds successfully (`npm run build`)
- [ ] Environment variables set in hosting platform
- [ ] App deployed and accessible
- [ ] Camera permissions working
- [ ] Focus detection working

## Support

For issues or questions:
- Check the console for error messages
- Review the other README files in the project
- Check hosting platform logs

---

**Happy Deploying! 🚀**

