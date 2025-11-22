# NeuroLens 3D Architecture

## System Overview

NeuroLens 3D is a real-time brain visualization system that processes webcam input to drive a 3D brain visualization. The system follows a client-server architecture with WebSocket communication for real-time updates.

## Data Flow

```
Webcam → MediaPipe Processing → Signal Extraction → WebSocket → Backend Processing → Brain Activations → WebSocket → 3D Visualization
```

## Components

### Backend (`server/`)

#### `index.js`
- Express HTTP server
- WebSocket server for real-time communication
- Receives signals from client
- Processes signals into brain activations
- Sends activation data back to client

#### `signalProcessor.js`
- Maps raw signals to brain region activations (0-1 scale)
- Implements heuristics from the specification:
  - Gaze direction → lobe activation
  - Facial expressions → emotional/attention states
  - Posture → motor/sensory regions
  - Heartbeat → stress/arousal levels
- Applies smoothing for stable visualization

#### `mlhsPresage.js`
- Placeholder for MLHS Presage SDK integration
- Currently simulates Presage output
- Ready for actual SDK integration

### Frontend (`client/src/`)

#### `App.js`
- Main React component
- Sets up Three.js Canvas
- Manages state (activations, signals, connection status)
- Coordinates components

#### `WebcamProcessor.js`
- Handles webcam access
- Initializes MediaPipe Face Mesh and Pose
- Extracts signals:
  - Gaze direction from eye landmarks
  - Facial expressions (eyebrows, smile, frown)
  - Posture from pose landmarks
  - Heartbeat via PPG from facial region
- Sends signals to backend via WebSocket
- Receives brain activation updates

#### `BrainVisualization.js`
- 3D brain model with 6 lobes
- Particle systems for neuron visualization
- Real-time material updates (emissive glow)
- Activation wave effects
- Heartbeat-synchronized pulse
- Stress shake effect
- Particle speed tied to cognitive arousal

#### `UI.js`
- Control panel overlay
- Shows brain region activations
- Displays live signals
- Connection status indicator

## Signal Processing Rules

### Frontal Lobe (Gold/Yellow)
- **Activation triggers:**
  - Gaze up (+0.4)
  - Raised eyebrows (+0.3)
  - High attention score (+0.2)
  - Upright posture (+0.1)

### Parietal Lobe (Cyan)
- **Activation triggers:**
  - Upright posture (+0.4)
  - Focused attention (+0.3)
  - Slouching (-0.2)

### Occipital Lobe (Blue)
- **Activation triggers:**
  - Gaze right (+0.3)
  - High blink rate (-0.3)
  - Gaze down (-0.2)
  - Low BPM (+0.1)

### Temporal Lobe (Orange)
- **Activation triggers:**
  - Gaze left (+0.4)
  - Smiling (+0.2)

### Cerebellum (Purple)
- **Activation triggers:**
  - Slouching (+0.2)
  - Low attention + low BPM (+0.1)

### Limbic System (Red/Orange)
- **Activation triggers:**
  - High BPM >110 (+0.5)
  - Pupil dilation (+0.3)
  - Frowning (+0.4)
  - High attention + high BPM (+0.2)
  - Low BPM (-0.1)

## Visualization Features

### Color Coding
- **Blue/Cyan**: Calm, focus
- **Gold/Yellow**: Attention, thinking
- **Red/Orange**: Stress, limbic activation
- **Purple**: Creative, mixed activity

### Animation Effects
1. **Glow Intensity**: Directly mapped to activation (0-1 → 0-2 emissive intensity)
2. **Particle Speed**: `avgActivation * (BPM/70) * lobeActivation`
3. **Global Pulse**: Synchronized to heartbeat BPM
4. **Stress Shake**: Subtle position jitter when BPM >110 or limbic >0.7
5. **Activation Waves**: Ring geometry pulses when activation >0.3

### Camera Controls
- OrbitControls from @react-three/drei
- Google Earth-style navigation
- Zoom, rotate, pan

## Performance Considerations

- Particle count: 500 per lobe (3000 total)
- Frame rate target: 60 FPS
- WebSocket update rate: ~30 Hz (matches webcam FPS)
- Signal smoothing: 10-frame moving average

## Future Enhancements

1. **MLHS Presage Integration**: Replace MediaPipe with actual Presage SDK
2. **Advanced Brain Model**: Load detailed 3D brain mesh
3. **Neural Pathways**: Visualize connections between regions
4. **Historical Data**: Track activation patterns over time
5. **Export/Recording**: Save visualization sessions
6. **Multi-user**: Support multiple simultaneous users
7. **Calibration**: Eye tracking calibration interface

## Dependencies

### Backend
- `express`: HTTP server
- `ws`: WebSocket server
- `cors`: CORS middleware
- `dotenv`: Environment variables

### Frontend
- `react`, `react-dom`: UI framework
- `three`: 3D graphics
- `@react-three/fiber`: React renderer for Three.js
- `@react-three/drei`: Three.js helpers
- `@mediapipe/face_mesh`: Face detection
- `@mediapipe/pose`: Pose estimation

## Security Notes

- WebSocket connections are not authenticated (add for production)
- Webcam access requires user permission
- No data is stored or transmitted externally
- All processing happens locally or on your server

