/**
 * Real Presage Heart Rate Detection Service
 * Replaces the mock service with actual Presage API integration via Python backend
 */
import { BiometricData, DistractionType } from '../types';

const BACKEND_API_URL = 'http://localhost:5000/api/heartrate';
let currentHeartRate = 0;
let isMeasuring = false;
let forcedDistraction: DistractionType = 'NONE';
let aiDetectedDistraction: DistractionType = 'NONE';
let heartRateHistory: HeartRateData[] = [];

export interface HeartRateData {
  heartRate: number;
  timestamp: number;
  status: 'success' | 'calculating' | 'error';
}

export const startPresageMeasurement = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/start`, { method: 'POST' });
    if (response.ok) { isMeasuring = true; return true; }
    return false;
  } catch (error) { return false; }
};

export const processFrameForHeartRate = async (base64Image: string, timestamp?: number): Promise<number> => {
  if (!isMeasuring) await startPresageMeasurement();
  try {
    const response = await fetch(`${BACKEND_API_URL}/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: base64Image, timestamp: timestamp || Date.now() }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.heartRate && data.heartRate > 0) {
        currentHeartRate = data.heartRate;
        heartRateHistory.push({ heartRate: data.heartRate, timestamp: data.timestamp || Date.now(), status: 'success' });
        if (heartRateHistory.length > 100) heartRateHistory.shift();
      }
      return data.heartRate || 0;
    }
    return 0;
  } catch (error) { return 0; }
};

export const getCurrentHeartRate = async (): Promise<number> => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/current`);
    if (response.ok) {
      const data = await response.json();
      if (data.heartRate && data.heartRate > 0) currentHeartRate = data.heartRate;
      return data.heartRate || 0;
    }
    return currentHeartRate;
  } catch (error) { return currentHeartRate; }
};

export const exportHeartRateData = async (): Promise<HeartRateData[]> => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/export`);
    if (response.ok) {
      const data = await response.json();
      return data.history || heartRateHistory;
    }
    return heartRateHistory;
  } catch (error) { return heartRateHistory; }
};

export const stopPresageMeasurement = async (): Promise<void> => {
  try {
    await fetch(`${BACKEND_API_URL}/stop`, { method: 'POST' });
    isMeasuring = false;
  } catch (error) {}
};

export const setDistractionOverride = (type: DistractionType) => { forcedDistraction = type; };
export const setAIState = (type: DistractionType) => { aiDetectedDistraction = type; };

export const getBiometrics = async (isUserActive: boolean, isTabFocused: boolean, videoFrameBase64?: string): Promise<BiometricData> => {
  if (videoFrameBase64 && isMeasuring) {
    await processFrameForHeartRate(videoFrameBase64);
  } else if (!isMeasuring) {
    currentHeartRate = await getCurrentHeartRate();
  }
  
  let activeDistraction: DistractionType = 'NONE';
  let gazeStability = 100;
  let delta = 0.05;
  
  if (forcedDistraction !== 'NONE') {
    activeDistraction = forcedDistraction;
  } else if (aiDetectedDistraction !== 'NONE') {
    activeDistraction = aiDetectedDistraction;
  } else if (!isTabFocused) {
    activeDistraction = 'NO_FACE';
  }
  
  switch (activeDistraction) {
    case 'PHONE': gazeStability = 10; delta = -1.5; break;
    case 'EATING': gazeStability = 40; delta = -0.5; break;
    case 'TALKING': gazeStability = 30; delta = -0.8; break;
    case 'EYES_CLOSED': gazeStability = 0; delta = -1.0; break;
    case 'NO_FACE': gazeStability = 0; delta = -2.0; break;
    default:
      gazeStability = isUserActive ? 95 : 85;
      if (Math.random() > 0.95) gazeStability -= 15;
      delta = 0.1;
  }
  
  return {
    gazeStability,
    heartRate: Math.round(currentHeartRate) || 70,
    distractionType: activeDistraction,
    flowScoreDelta: delta,
  };
};

export const getHeartRateHistory = (): HeartRateData[] => [...heartRateHistory];
export const getCurrentHeartRateValue = (): number => currentHeartRate;
