
export enum GameState {
  LOBBY = 'LOBBY',
  STAKING = 'STAKING',
  PLAYING = 'PLAYING',
  VERIFYING = 'VERIFYING',
  RESULTS = 'RESULTS',
}

export type DistractionType = 'NONE' | 'PHONE' | 'NO_FACE' | 'EYES_CLOSED' | 'TALKING' | 'EATING';

export interface Player {
  id: string;
  name: string;
  isSelf: boolean;
  health: number; // 0-100
  flowScore: number;
  avatar: string;
  status: 'FOCUS' | 'DISTRACTED' | 'PANIC' | DistractionType;
  heartRate: number;
}

export interface BiometricData {
  gazeStability: number; // 0-100
  heartRate: number;
  distractionType: DistractionType;
  flowScoreDelta: number;
}

export interface VerificationResult {
  verified: boolean;
  score: number;
  comment: string;
}
