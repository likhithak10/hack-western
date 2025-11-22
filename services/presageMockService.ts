
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

// --- Input Handling ---

// 1. Developer Override (Highest Priority)
export const setDistractionOverride = (type: DistractionType) => {
  forcedDistraction = type;
};

// 2. Frame Processing Pipeline
export const processFrame = async (base64Frame: string): Promise<DistractionType> => {
  // Attempt to send to backend first
  const sentToSocket = socketService.sendFrame(base64Frame);
  
  if (sentToSocket) {
    isRemoteActive = true;
    // When using remote, we wait for the 'biometric_update' socket event to update state.
    // We return the *current* state for immediate UI feedback, but the source of truth is the socket callback.
    return currentDistraction;
  } else {
    isRemoteActive = false;
    // Fallback: Local Gemini Analysis
    // We only run this if socket is dead to save costs/quota
    const result = await analyzeUserStatus(base64Frame);
    updateLocalState(result);
    return result;
  }
};

// --- State Management ---

// Initialize Socket Listeners
socketService.onBiometricUpdate((data) => {
  if (data.distractionType) currentDistraction = data.distractionType;
  if (data.heartRate) currentHeartRate = data.heartRate;
  if (data.gazeStability) currentGazeStability = data.gazeStability;
  isRemoteActive = true;
});

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
