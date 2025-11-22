# NeuroLens 3D Setup Guide

## Prerequisites

- Node.js 16+ and npm
- A webcam for real-time tracking
- Modern browser with WebGL support

## Installation

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` if you need to change ports or WebSocket URL.

## Running the Application

### Development Mode

Start both backend and frontend:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend React app on `http://localhost:3000`

### Manual Start

If you prefer to run them separately:

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

## Usage

1. Open `http://localhost:3000` in your browser
2. Allow webcam access when prompted
3. The system will automatically:
   - Detect your gaze direction
   - Track facial expressions
   - Monitor posture
   - Measure heartbeat (BPM)
4. Watch your brain regions light up in real-time!

## MLHS Presage Integration

**Note:** The current implementation uses MediaPipe Face Mesh as a fallback for eye tracking. To integrate actual MLHS Presage:

1. Install the MLHS Presage SDK
2. Update `server/mlhsPresage.js` with the actual Presage API calls
3. Replace the `simulatePresageOutput()` method with real Presage processing

The code structure is ready for Presage integration - simply replace the simulation logic with actual API calls.

## Troubleshooting

### Webcam not working
- Ensure you've granted browser permissions
- Check that no other application is using the webcam
- Try refreshing the page

### WebSocket connection failed
- Ensure the backend server is running on port 3001
- Check firewall settings
- Verify `REACT_APP_WS_URL` in `.env` matches your backend URL

### Performance issues
- Reduce particle count in `BrainVisualization.js` (currently 500 per lobe)
- Lower canvas resolution in `WebcamProcessor.js`
- Close other browser tabs/applications

## Architecture

- **Backend (`server/`)**: Express server with WebSocket for real-time communication
- **Frontend (`client/`)**: React + Three.js for 3D visualization
- **Signal Processing**: Maps webcam inputs to brain region activations
- **Visualization**: Real-time 3D brain with particle systems and glow effects

## Customization

### Adjust Brain Colors
Edit `LOBE_COLORS` in `client/src/components/BrainVisualization.js`

### Modify Activation Rules
Edit signal processing logic in `server/signalProcessor.js`

### Change Particle Count
Modify `particleCount` in `BrainVisualization.js` (line ~51)

