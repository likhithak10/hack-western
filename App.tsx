
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, BiometricData, DistractionType } from './types';
import { simulateBiometrics, setDistractionOverride, processFrame } from './services/presageMockService';
import { verifyWork } from './services/geminiService';
import { socketService } from './services/socketService';
import { Leaderboard } from './components/Leaderboard';
import { BiometricHUD } from './components/BiometricHUD';
import { ArrowRight, ShieldCheck, Eye, RefreshCcw, Smartphone, Coffee, MessageCircle, UserX, EyeOff, Zap, Cloud } from 'lucide-react';

const TOTAL_TIME = 25 * 60; // 25 minutes in seconds
const BOT_NAMES = ["ApexFocus", "DeepWorker99", "FlowState_Chad", "CryptoNomad", "ZenMaster"];
const UPDATE_MS = 100; // 10hz update rate for animation
const INITIAL_VISION_DELAY_MS = 200; 

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [stakeAmount, setStakeAmount] = useState<number>(0.5);
  const [walletConnected, setWalletConnected] = useState(false);
  const [workContent, setWorkContent] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selfBiometrics, setSelfBiometrics] = useState<BiometricData>({
    gazeStability: 100,
    heartRate: 70,
    distractionType: 'NONE',
    flowScoreDelta: 0
  });
  const [verificationResult, setVerificationResult] = useState<{score: number, comment: string} | null>(null);
  const [isProcessingVision, setIsProcessingVision] = useState(false);
  const [usingRemoteBackend, setUsingRemoteBackend] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Smoothing Buffer
  const lastDetectionRef = useRef<DistractionType>('NONE');

  // --- Game Logic Helpers ---

  const initializeBots = () => {
    const bots: Player[] = BOT_NAMES.map((name, idx) => ({
      id: `bot-${idx}`,
      name,
      isSelf: false,
      health: 100,
      flowScore: 1000,
      avatar: `https://picsum.photos/seed/${name}/50/50`,
      status: 'FOCUS',
      heartRate: 60 + Math.random() * 20
    }));
    return bots;
  };

  const initializeSelf = (): Player => ({
    id: 'self',
    name: 'You',
    isSelf: true,
    health: 100,
    flowScore: 1000,
    avatar: 'https://picsum.photos/seed/self/50/50',
    status: 'FOCUS',
    heartRate: 70
  });

  // --- Effects ---

  // Initialize Services
  useEffect(() => {
    const initServices = async () => {
       // Connect Socket
       socketService.connect();
       socketService.onLobbyUpdate((serverPlayers) => {
          // Merge server players with bots if needed, or replace entirely
          // For now, we just log it to show connection
          console.log("Lobby updated from Presage backend:", serverPlayers);
       });
       
       // Check Wallet - Mocked for now
       // const connected = await solanaService.connect();
       // setWalletConnected(connected);
    };
    initServices();

    return () => {
      socketService.disconnect();
    };
  }, []);

  // Update Remote Status Indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setUsingRemoteBackend(socketService.isConnected());
    }, 2000);
    return () => clearInterval(interval);
  }, []);


  // Main Game Loop
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const interval = setInterval(() => {
      const isTabFocused = document.visibilityState === 'visible';
      
      // Get physics state (Remote or Local)
      const newBiometrics = simulateBiometrics(true, isTabFocused);
      setSelfBiometrics(newBiometrics);

      // Emit our state to multiplayer server
      if (socketService.isConnected()) {
         // We don't need to emit biometric data back if the server is the one generating it!
         // But we might want to emit our 'work' progress or keepalive
      }

      setPlayers(prevPlayers => {
        return prevPlayers.map(p => {
          if (p.isSelf) {
            const newHealth = Math.min(100, Math.max(0, p.health + (newBiometrics.flowScoreDelta < 0 ? -0.5 : 0.05)));
            const newScore = p.flowScore + newBiometrics.flowScoreDelta;
            return {
              ...p,
              health: newHealth,
              flowScore: newScore,
              heartRate: newBiometrics.heartRate,
              status: newBiometrics.distractionType === 'NONE' ? 'FOCUS' : newBiometrics.distractionType
            };
          } else {
            // Bot Simulation Logic
            const changeState = Math.random() > 0.99;
            let currentStatus = p.status;
            let scoreDelta = 0.1;

            if (changeState) {
               const roll = Math.random();
               if (roll > 0.95) currentStatus = 'PHONE';
               else if (roll > 0.90) currentStatus = 'TALKING';
               else if (roll > 0.85) currentStatus = 'EATING';
               else if (roll > 0.80) currentStatus = 'NO_FACE';
               else currentStatus = 'FOCUS';
            }

            if (currentStatus === 'PHONE') scoreDelta = -1.5;
            if (currentStatus === 'TALKING') scoreDelta = -0.8;
            if (currentStatus === 'EATING') scoreDelta = -0.5;
            if (currentStatus === 'NO_FACE') scoreDelta = -2.0;
            if (currentStatus === 'FOCUS') scoreDelta = 0.1;

            const healthChange = scoreDelta < 0 ? -0.5 : 0.05;

            return {
              ...p,
              flowScore: p.flowScore + scoreDelta,
              health: Math.min(100, Math.max(0, p.health + healthChange)),
              status: currentStatus,
              heartRate: Math.round(p.heartRate + (Math.random() - 0.5) * 2)
            };
          }
        });
      });

      setTimeLeft(prev => {
        if (prev <= 0.1) {
          setGameState(GameState.VERIFYING);
          return 0;
        }
        return prev - (UPDATE_MS / 1000);
      });

    }, UPDATE_MS);

    return () => clearInterval(interval);
  }, [gameState]);

  // Vision / Presage Loop
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const runVisionCheck = async () => {
      if (!isMounted) return;

      let nextDelay = INITIAL_VISION_DELAY_MS;

      if (videoRef.current && canvasRef.current && !isProcessingVision) {
         setIsProcessingVision(true);
         try {
           const video = videoRef.current;
           const canvas = canvasRef.current;
           const ctx = canvas.getContext('2d');
           
           if (ctx && video.videoWidth > 0) {
              canvas.width = 280; 
              canvas.height = 210;
              ctx.drawImage(video, 0, 0, 280, 210);
              const base64 = canvas.toDataURL('image/jpeg', 0.8); 
              
              // Route to Presage Orchestrator (Remote or Local)
              const result = await processFrame(base64);
              
              // Smoothing / Buffering
              const prev = lastDetectionRef.current;
              let confirmedState: DistractionType = 'NONE';

              if (result === 'NONE') {
                confirmedState = 'NONE';
              } else if (result === 'PHONE' || result === 'EATING' || result === 'TALKING') {
                 confirmedState = result;
              } else {
                 // Buffer ambiguous states if using Local Mode
                 // (If remote, we trust the backend more, but buffering still helps UI flicker)
                 if (prev === result) {
                    confirmedState = result;
                 } else {
                    confirmedState = prev; 
                 }
              }
              
              lastDetectionRef.current = confirmedState === 'NONE' ? result : confirmedState; 
              
              // Adaptive Polling - Minimal delay for "Continuous" feel
              if (confirmedState !== 'NONE') {
                nextDelay = 50; // 50ms when distracted (spam to clear penalty)
              } else {
                nextDelay = 100; // 100ms when focused (very fast monitoring)
              }
           }
         } catch (e) {
           console.error("Vision loop error:", e);
           nextDelay = 4000; // Backoff on error
         } finally {
           setIsProcessingVision(false);
         }