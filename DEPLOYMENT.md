# VoiceGov - Deployment Guide

## Quick Deploy to Vercel (Recommended - FREE)

1. **Install Vercel CLI** (optional, or use web):
   ```bash
   npm i -g vercel
   ```

2. **Deploy via CLI**:
   ```bash
   vercel
   ```
   
   OR **Deploy via Web**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import from GitHub: `Code-o-pathy/VoiceGov`
   - Framework Preset: Next.js (auto-detected)
   - Click "Deploy"

3. **Environment Variables** (optional - for Gemini API):
   - In Vercel dashboard → Settings → Environment Variables
   - Add: `GEMINI_API_KEY` = your key
   - Without this, the app uses deterministic fallbacks (still works!)

## What Works Without Any API Key

✅ **Everything works offline/locally:**
- Voice recognition (Web Speech API - browser built-in)
- All 8 services with forms and validation
- Deterministic intent detection
- Deterministic planning
- Mock backend with realistic results
- Text-to-speech (browser built-in)

## What the Gemini API Adds (Optional Enhancement)

🔹 **With `GEMINI_API_KEY` configured:**
- Better intent understanding for edge cases
- Smarter field interpretation
- Fallback transcription for Brave browser

**The app is designed to work perfectly without any API keys** - Gemini is only an optional enhancement.

## Deployment Platforms

### Vercel (Recommended)
- **Cost**: FREE for hobby projects
- **Setup**: 2 minutes
- **Auto HTTPS**: Yes
- **Custom domain**: Yes (free)
- **Best for**: Next.js apps

### Netlify
```bash
npm run build
# Deploy the `out` folder
```

### Railway
- Import from GitHub
- Auto-detects Next.js
- Free tier available

## API Endpoints

Your app has 3 API routes:
- `/api/config` - Returns whether Gemini is available
- `/api/intent` - Intent detection (falls back to local)
- `/api/plan` - Action planning (falls back to local)
- `/api/interpret` - Field interpretation (falls back to local)
- `/api/transcribe` - Audio transcription (only if Gemini configured)

**All fallback to deterministic local implementations** if Gemini is not configured.

## Environment Variables

Create `.env.local` (already in `.gitignore`):
```bash
# Optional - app works without this
GEMINI_API_KEY=your_key_here
```

## Post-Deployment Checklist

✅ App loads and shows the home page  
✅ Voice button asks for microphone permission  
✅ Can navigate services manually  
✅ Forms validate and submit  
✅ Results display correctly  
✅ Voice commands work (try: "check my refund status")  

## Troubleshooting

**Voice not working?**
- Check browser: Chrome/Edge recommended
- Allow microphone permission
- Brave blocks Google Speech API by default

**Build errors?**
- Run `npm run build` locally first
- Check Node version: 18+ required

**API routes not working?**
- They should auto-deploy with your app
- Check `/api/config` endpoint is accessible
- Fallbacks kick in automatically if there's an issue

## Demo URL
After deploying, Vercel gives you: `https://voice-gov-xxxxx.vercel.app`

Share this link for your hackathon submission!
