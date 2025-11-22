# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm run install-all
```

### 2. Start the Application
```bash
npm run dev
```

### 3. Open in Browser
Navigate to `http://localhost:3000` and allow webcam access.

## 🎮 What to Try

1. **Look Up** → Frontal lobe glows gold (attention/planning)
2. **Look Left** → Temporal lobe glows orange (language/memory)
3. **Look Right** → Occipital lobe glows blue (visual processing)
4. **Raise Eyebrows** → Frontal lobe activation increases
5. **Smile** → Temporal lobe activates
6. **Slouch** → Cerebellum and parietal changes
7. **Move Around** → Heartbeat detection affects global pulse

## 📊 Understanding the Visualization

- **Color Intensity** = Activation level (0-100%)
- **Particle Speed** = Cognitive arousal (faster = more active)
- **Global Pulse** = Synchronized to your heartbeat
- **Shake Effect** = High stress (BPM >110 or high limbic activation)

## 🛠 Troubleshooting

**Webcam not working?**
- Check browser permissions
- Ensure no other app is using the camera
- Try a different browser

**No connection?**
- Verify backend is running on port 3001
- Check browser console for errors
- Ensure firewall isn't blocking WebSocket

**Performance issues?**
- Reduce particle count in `BrainVisualization.js` (line ~51)
- Lower webcam resolution
- Close other tabs

## 📁 Key Files

- `client/src/components/BrainVisualization.js` - 3D brain model
- `server/signalProcessor.js` - Activation mapping rules
- `client/src/components/WebcamProcessor.js` - Signal extraction

## 🔧 Customization

**Change colors?** Edit `LOBE_COLORS` in `BrainVisualization.js`

**Adjust activation rules?** Modify `signalProcessor.js`

**Change particle count?** Edit `particleCount` in `BrainVisualization.js`

## 📚 More Info

- See `README.md` for full documentation
- See `ARCHITECTURE.md` for technical details
- See `SETUP.md` for detailed setup instructions

