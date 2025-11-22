# NeuroLens 3D

A real-time, Google Earth-style brain visualizer that uses MLHS Presage for eye tracking, gaze prediction, pupil detection, blink tracking, and attention metrics, plus pose and heartbeat detection from webcam.

## Features

- **Real-time Eye Tracking**: MLHS Presage integration for gaze, pupil, and blink detection
- **3D Brain Visualization**: Interactive Three.js brain with Google Earth-style navigation
- **Live Neuron Animation**: Particle systems showing neural activity in real-time
- **Multi-Signal Processing**: Combines gaze, facial expressions, posture, and heartbeat
- **Dynamic Activation Mapping**: Maps signals to brain regions with color-coded visualizations

## Installation

```bash
npm run install-all
```

## Development

```bash
npm run dev
```

This starts both the backend server (port 3001) and frontend client (port 3000).

## Usage

1. Allow webcam access when prompted
2. The system will automatically detect:
   - Eye movements and gaze direction
   - Facial expressions (eyebrows, smile, frown)
   - Posture (slouching vs upright)
   - Heartbeat (BPM from webcam)
3. Watch your brain regions light up in real-time!

## Brain Region Mapping

- **Frontal Lobe**: Attention, planning (Gold/Yellow glow)
  - Activated by: Gaze up, raised eyebrows, high attention score
- **Parietal Lobe**: Sensory integration (Cyan/Green glow)
  - Activated by: Upright posture, focused attention
- **Occipital Lobe**: Visual processing (Blue glow)
  - Activated by: Gaze right, visual focus
- **Temporal Lobe**: Language, memory (Orange glow)
  - Activated by: Gaze left, smiling
- **Cerebellum**: Motor control (Purple glow)
  - Activated by: Posture changes, motor activity
- **Limbic System**: Emotion, stress (Red/Orange glow)
  - Activated by: High BPM, pupil dilation, frowning

## Technical Details

### Current Implementation
- **Eye Tracking**: Uses MediaPipe Face Mesh as a fallback (ready for MLHS Presage integration)
- **Pose Detection**: MediaPipe Pose for posture analysis
- **Heartbeat Detection**: PPG (Photoplethysmography) from facial region
- **3D Visualization**: Three.js with React Three Fiber
- **Real-time Communication**: WebSocket for low-latency updates

### MLHS Presage Integration
The codebase is structured to easily integrate MLHS Presage. See `server/mlhsPresage.js` for the integration point. Currently uses MediaPipe as a fallback for demonstration purposes.

## Project Structure

```
├── server/              # Backend Express server
│   ├── index.js        # Main server with WebSocket
│   ├── signalProcessor.js  # Maps signals to brain activations
│   └── mlhsPresage.js  # MLHS Presage integration (ready for SDK)
├── client/             # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── BrainVisualization.js  # 3D brain with particles
│   │   │   ├── WebcamProcessor.js    # Webcam + MediaPipe processing
│   │   │   └── UI.js                 # Control panel
│   │   └── App.js
└── scripts/            # Startup scripts
```

## Controls

- **Mouse Drag**: Rotate brain
- **Scroll**: Zoom in/out
- **Right Click + Drag**: Pan (if enabled)

## Performance Tips

- Particle count is set to 500 per lobe (adjustable in `BrainVisualization.js`)
- Lower webcam resolution if experiencing lag
- Close other browser tabs for better performance

