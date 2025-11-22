# Quick Deployment Guide

## Fastest Way to Deploy (Vercel)

### 1. Get Your Gemini API Key
- Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create a new API key
- Copy it

### 2. Deploy to Vercel

**Option A: Using Vercel Website (Easiest)**
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project"
3. Import your Git repository
4. In "Environment Variables", add:
   - Name: `GEMINI_API_KEY`
   - Value: `your_api_key_here`
5. Click "Deploy"
6. Done! Your app will be live in ~2 minutes

**Option B: Using Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable when prompted, or add it in Vercel dashboard
```

### 3. That's It!

Your app is now live. Visit the URL Vercel gives you.

## What You Need

- ✅ Node.js (v18+)
- ✅ Gemini API Key (free from Google)
- ✅ Git repository (GitHub, GitLab, etc.)

## Optional: Local Testing First

```bash
# 1. Clone and install
git clone <repo-url>
cd hack-western-2
npm install

# 2. Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Run locally
npm run dev

# 4. Visit http://localhost:3000
```

## Other Hosting Options

- **Netlify**: Similar to Vercel, just connect your repo
- **GitHub Pages**: Free but requires extra setup
- **Any static host**: Upload the `dist/` folder after `npm run build`

## Need Help?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

