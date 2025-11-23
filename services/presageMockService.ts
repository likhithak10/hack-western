
import { BiometricData, DistractionType } from '../types';
import { analyzeUserStatus } from './geminiService';
import { socketService } from './socketService';

// PRESAGE ORCHESTRATOR
// This service routes vision data to either:
// A) The Remote Backend (C++ SmartSpectra Engine) via WebSockets
// B) The Local Fallback (Gemini 2.5 Flash) if backend is offline

let currentHeartRate = 70;
let forcedDistraction: DistractionType = 'NONE'; // Dev Override
let currentDistraction: DistractionType = 'NONE';
let currentGazeStability = 100;
let isRemoteActive = false;
let lastGeminiRunMs = 0;
const GEMINI_INTERVAL_DISTRACTED_MS = Number((process.env.GEMINI_INTERVAL_DISTRACTED as any) || 100);
const GEMINI_INTERVAL_FOCUS_MS = Number((process.env.GEMINI_INTERVAL_FOCUS as any) || 180);
const SMOOTH_EYES_CLOSED_MS = Number((process.env.SMOOTH_EYES_CLOSED_MS as any) || 1200);
const SMOOTH_NO_FACE_MS = Number((process.env.SMOOTH_NO_FACE_MS as any) || 400);
const SMOOTH_OTHER_MS = Number((process.env.SMOOTH_OTHER_MS as any) || 250);
const SMOOTH_RECOVERY_MS = Number((process.env.SMOOTH_RECOVERY_MS as any) || 200);
// Enable remote backend only when explicitly configured (prevents noisy websocket errors)
let REMOTE_BACKEND_ENABLED = false;
try {
  REMOTE_BACKEND_ENABLED = ((import.meta as any).env?.VITE_REMOTE_BACKEND === 'true');
} catch {
  REMOTE_BACKEND_ENABLED = false;
}

// Local smoothing state (debounce transient misclassifications like blinks)
let candidateType: DistractionType = 'NONE';
let candidateSinceMs: number = 0;

// --- Input Handling ---

// 1. Developer Override (Highest Priority)
export const setDistractionOverride = (type: DistractionType) => {
  forcedDistraction = type;
};

function getThresholdFor(type: DistractionType): number {
  switch (type) {
    case 'EYES_CLOSED': return SMOOTH_EYES_CLOSED_MS;
    case 'NO_FACE': return SMOOTH_NO_FACE_MS;
    case 'PHONE':
    case 'EATING':
    case 'TALKING': return SMOOTH_OTHER_MS;
    case 'NONE':
    default: return SMOOTH_RECOVERY_MS;
  }
}

function smoothLocalDetection(detected: DistractionType): DistractionType {
  const now = Date.now();
  if (detected !== candidateType) {
    candidateType = detected;
    candidateSinceMs = now;
  }
  const threshold = getThresholdFor(candidateType);
  const elapsed = now - candidateSinceMs;

  // If already committed to this type, keep it
  if (currentDistraction === candidateType) return currentDistraction;

  // Commit only after threshold to avoid flicker (blinks -> EYES_CLOSED false positives)
  if (elapsed >= threshold) {
    return candidateType;
  }

  // Not yet stable; keep current
  return currentDistraction;
}

// 2. Frame Processing Pipeline
export const processFrame = async (base64Frame: string): Promise<DistractionType> => {
  // Attempt to send to backend (for vitals / pipeline)
  if (REMOTE_BACKEND_ENABLED) {
    if (!socketService.isConnected()) {
      socketService.connect();
    }
    const sentToSocket = socketService.isConnected() ? (socketService.sendFrame(base64Frame), true) : false;
    isRemoteActive = sentToSocket;
  } else {
    isRemoteActive = false;
  }

  // Always compute distraction locally via Gemini:
  // - pure fallback when remote is not active, or
  // - blend with remote vitals at an adaptive cadence
  const now = Date.now();
  const intervalTarget = currentDistraction === 'NONE' ? GEMINI_INTERVAL_FOCUS_MS : GEMINI_INTERVAL_DISTRACTED_MS;
  const shouldRunGemini = !isRemoteActive || (now - lastGeminiRunMs) >= intervalTarget;

  if (shouldRunGemini) {
    lastGeminiRunMs = now;
    const detected = await analyzeUserStatus(base64Frame);
    const smoothed = smoothLocalDetection(detected);
    updateLocalState(smoothed);
    return smoothed;
  }

  // Otherwise return current state (recent result from socket or last Gemini)
  return currentDistraction;
};

// --- State Management ---

// Initialize Socket Listeners (only when remote is enabled)
if (REMOTE_BACKEND_ENABLED) {
  socketService.onBiometricUpdate((data: Partial<BiometricData>) => {
    if (data.distractionType) currentDistraction = data.distractionType as DistractionType;
    if (typeof data.heartRate === 'number') currentHeartRate = data.heartRate;
    if (typeof data.gazeStability === 'number') currentGazeStability = data.gazeStability;
    isRemoteActive = true;
  });
}

const updateLocalState = (detectedType: DistractionType) => {
  currentDistraction = detectedType;
  
  // Simulate physiological changes for Local Mode since we don't have real sensor data
  if (detectedType === 'PHONE') {
    currentGazeStability = 10;
    currentHeartRate = 110;
  } else if (detectedType === 'NONE') {
    currentGazeStability = 95;
    currentHeartRate = 70;
  } else {
    currentGazeStability = 40;
    currentHeartRate = 85;
  }
};


// --- Game Loop Integration ---

export const simulateBiometrics = (isUserActive: boolean, isTabFocused: boolean): BiometricData => {
  // Priority: Dev Override > Real/Gemini State > Tab Focus
  
  let activeDistraction: DistractionType = 'NONE';
  
  if (forcedDistraction !== 'NONE') {
    activeDistraction = forcedDistraction;
  } else if (currentDistraction !== 'NONE') {
    activeDistraction = currentDistraction;
  } else if (!isTabFocused) {
    activeDistraction = 'NO_FACE'; 
  }

  // Calculate Flow Delta based on Distraction
  let delta = 0.1;
  
  switch (activeDistraction) {
    case 'PHONE': delta = -1.5; break;
    case 'EATING': delta = -0.5; break;
    case 'TALKING': delta = -0.8; break;
    case 'EYES_CLOSED': delta = -1.0; break;
    case 'NO_FACE': delta = -2.0; break;
    case 'NONE': delta = 0.1; break;
  }

  // Physics Smoothing for HR (if locally simulating)
  // If remote is active, we trust the backend HR completely (don't smooth it)
  if (!isRemoteActive) {
    const approachSpeed = 0.05;
    let targetHR = 70;
    if (activeDistraction === 'PHONE') targetHR = 110;
    else if (activeDistraction === 'TALKING') targetHR = 95;
    else if (activeDistraction === 'EYES_CLOSED') targetHR = 55;
    
    currentHeartRate = currentHeartRate + (targetHR - currentHeartRate) * approachSpeed;
  }

  // Add noise
  const noise = (Math.random() - 0.5) * (isRemoteActive ? 0 : 3); // No noise if remote (trust sensor)

  return {
    gazeStability: currentGazeStability,
    heartRate: Math.round(currentHeartRate + noise),
    distractionType: activeDistraction,
    flowScoreDelta: delta
  };
};
