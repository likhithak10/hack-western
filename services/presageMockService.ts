
import { BiometricData, DistractionType } from '../types';

// This simulates the Presage API logic, now driven by Real-Time Gemini Vision
// API Key Provided in prompt: 2BwfYdU0gG7QXEEi8wIwD1FUgpUWhd3y5A30zGb8

let currentHeartRate = 70;
let forcedDistraction: DistractionType = 'NONE'; // Dev Override
let aiDetectedDistraction: DistractionType = 'NONE'; // Real AI Detection

// Called by the Developer Buttons
export const setDistractionOverride = (type: DistractionType) => {
  forcedDistraction = type;
};

// Called by the Gemini Vision Loop
export const setAIState = (type: DistractionType) => {
  aiDetectedDistraction = type;
};

export const simulateBiometrics = (isUserActive: boolean, isTabFocused: boolean): BiometricData => {
  // 1. Determine Base State Priority: Dev Override > AI Detection > Tab Focus > Default
  let targetHR = 70;
  let gazeStability = 100;
  
  // Decide which distraction is active
  let activeDistraction: DistractionType = 'NONE';
  
  if (forcedDistraction !== 'NONE') {
    activeDistraction = forcedDistraction;
  } else if (aiDetectedDistraction !== 'NONE') {
    activeDistraction = aiDetectedDistraction;
  } else if (!isTabFocused) {
    activeDistraction = 'NO_FACE'; // Assuming if tab hidden, user is effectively gone in this rigorous mode
  }

  let delta = 0.05; // Base gain per tick (100ms)

  // 2. Apply Physics based on Distraction Type
  switch (activeDistraction) {
    case 'PHONE':
      targetHR = 110; // Dopamine/Panic spike
      gazeStability = 10; // Looking at phone, not screen
      delta = -1.5; // Heavy penalty
      break;
    case 'EATING':
      targetHR = 85; // Slight elevation
      gazeStability = 40; // Erratic
      delta = -0.5; // Medium penalty
      break;
    case 'TALKING':
      targetHR = 95; // Social interaction raises HR
      gazeStability = 30; // Looking at person
      delta = -0.8;
      break;
    case 'EYES_CLOSED':
      targetHR = 55; // Drowsy
      gazeStability = 0;
      delta = -1.0;
      break;
    case 'NO_FACE':
      targetHR = 70;
      gazeStability = 0;
      delta = -2.0; // Immediate penalty for leaving desk
      break;
    case 'NONE':
    default:
      // Normal Flow State
      targetHR = isUserActive ? 75 : 65;
      gazeStability = isUserActive ? 95 : 85;
      
      // Micro-glitches (natural movements)
      if (Math.random() > 0.95) gazeStability -= 15;
      
      delta = 0.1; // Flow state building up
      break;
  }

  // 3. Smooth Heart Rate Transition (Simulates physiological lag)
  const approachSpeed = 0.05;
  currentHeartRate = currentHeartRate + (targetHR - currentHeartRate) * approachSpeed;
  
  // Add physiological noise
  const noise = (Math.random() - 0.5) * 3; 
  const finalHR = Math.round(currentHeartRate + noise);

  return {
    gazeStability,
    heartRate: finalHR,
    distractionType: activeDistraction,
    flowScoreDelta: delta
  };
};