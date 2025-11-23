
import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { GameState, Player, BiometricData, DistractionType } from './types';
import { simulateBiometrics, setDistractionOverride, processFrame } from './services/presageMockService';
import { verifyWork, analyzeUserStatus } from './services/geminiService';
import { Leaderboard } from './components/Leaderboard';
import { BiometricHUD } from './components/BiometricHUD';
import * as solanaService from './services/solanaService';
import { ArrowRight, ShieldCheck, Eye, RefreshCcw, Smartphone, Coffee, MessageCircle, UserX, EyeOff, Wallet } from 'lucide-react';

const BOT_NAMES = ["Likhitha", "Sophie", "Michelle", "Aiden", "Chahana"];
const UPDATE_MS = 100; // 10hz update rate for animation
const INITIAL_VISION_DELAY_MS = 200;
const FOCUS_SCORE_UPDATE_INTERVAL = 5000; // Update Solana every 5 seconds
const SESSION_DURATION_MINUTES = 1; // Minimum session is one minute (testing)
const DISTRACTION_PENALTY_RATE = 0.2; // Simulated: distracted players lose 20% of stake to the winner

export default function App() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState<number>(0.1);
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
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [escrowAccount, setEscrowAccount] = useState<solanaService.EscrowAccount | null>(null);
  const [penalties, setPenalties] = useState<Record<string, number>>({});
  const [payouts, setPayouts] = useState<Record<string, number> | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastScoreUpdateRef = useRef<number>(0);
  
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

  // --- Simulated Payouts ---
  const computePayouts = (finalPlayers: Player[], perPlayerStake: number): Record<string, number> => {
    const distribution: Record<string, number> = {};
    if (!finalPlayers.length) return distribution;
    const winner = [...finalPlayers].sort((a, b) => b.flowScore - a.flowScore)[0];
    let penaltyPool = 0;
    for (const p of finalPlayers) {
      const isDistracted = p.status !== 'FOCUS';
      if (p.id === winner.id) {
        distribution[p.id] = perPlayerStake; // base; add penalties after loop
      } else if (isDistracted) {
        const penalty = perPlayerStake * DISTRACTION_PENALTY_RATE;
        distribution[p.id] = Math.max(0, perPlayerStake - penalty);
        penaltyPool += penalty;
      } else {
        distribution[p.id] = perPlayerStake;
      }
    }
    distribution[winner.id] = (distribution[winner.id] || 0) + penaltyPool;
    return distribution;
  };
  
  // Simulated payouts from accumulated distracted time penalties over the entire session.
  const computePayoutsFromPenalties = (finalPlayers: Player[], perPlayerStake: number, penaltyByPlayer: Record<string, number>): Record<string, number> => {
    const distribution: Record<string, number> = {};
    if (!finalPlayers.length) return distribution;
    const topScore = Math.max(...finalPlayers.map(p => p.flowScore));
    const winners = finalPlayers.filter(p => p.flowScore === topScore);
    const totalPenaltyPool = finalPlayers.reduce((sum, p) => sum + Math.min(perPlayerStake, penaltyByPlayer[p.id] || 0), 0);
    const bonusPerWinner = winners.length > 0 ? totalPenaltyPool / winners.length : 0;
    for (const p of finalPlayers) {
      const lost = Math.min(perPlayerStake, penaltyByPlayer[p.id] || 0);
      const base = Math.max(0, perPlayerStake - lost);
      const bonus = winners.find(w => w.id === p.id) ? bonusPerWinner : 0;
      distribution[p.id] = base + bonus;
    }
    return distribution;
  };

  // --- Effects ---

  // Remote status indicator (default to cloud until kernel is wired)
  useEffect(() => {
    setUsingRemoteBackend(false);
  }, []);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (wallet.publicKey) {
        try {
          const balance = await solanaService.getBalance(wallet);
          setSolBalance(balance);
        } catch (error) {
          console.error('Failed to fetch balance:', error);
        }
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [wallet.publicKey]);

  // Fetch escrow account
  useEffect(() => {
    const fetchEscrow = async () => {
      if (wallet.publicKey && wallet.connected) {
        // fetchEscrowAccount handles all errors internally and returns null
        // No need to catch here - it will never throw
        const escrow = await solanaService.fetchEscrowAccount(wallet);
        setEscrowAccount(escrow);
      }
    };
    fetchEscrow();
    const interval = setInterval(fetchEscrow, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [wallet.publicKey, wallet.connected]);


  // Main Game Loop - Focus Score Based
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const interval = setInterval(() => {
      const isTabFocused = document.visibilityState === 'visible';
      const distractedMap: Record<string, boolean> = {};
      
      // Get physics state (Remote or Local)
      const newBiometrics = simulateBiometrics(true, isTabFocused);
      setSelfBiometrics(newBiometrics);

      setPlayers(prevPlayers => {
        return prevPlayers.map(p => {
          if (p.isSelf) {
            const newHealth = Math.min(100, Math.max(0, p.health + (newBiometrics.flowScoreDelta < 0 ? -0.5 : 0.05)));
            const newScore = p.flowScore + newBiometrics.flowScoreDelta;
            
            // Update focus score on Solana every FOCUS_SCORE_UPDATE_INTERVAL
            const now = Date.now();
            if (now - lastScoreUpdateRef.current > FOCUS_SCORE_UPDATE_INTERVAL && wallet.connected && wallet.publicKey) {
              lastScoreUpdateRef.current = now;
              solanaService.updateFocusScore(wallet, newScore).catch(err => {
                console.error('Failed to update focus score on-chain:', err);
              });
            }
            
            const newStatusVal = newBiometrics.distractionType === 'NONE' ? 'FOCUS' : newBiometrics.distractionType;
            distractedMap[p.id] = newStatusVal !== 'FOCUS';
            return {
              ...p,
              health: newHealth,
              flowScore: newScore,
              heartRate: newBiometrics.heartRate,
              status: newStatusVal
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

            distractedMap[p.id] = currentStatus !== 'FOCUS';
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

      // Accumulate distraction penalties for the current tick
      const penaltyPerMs = stakeAmount / (SESSION_DURATION_MINUTES * 60 * 1000);
      const increment = penaltyPerMs * UPDATE_MS;
      setPenalties(prev => {
        const next: Record<string, number> = { ...prev };
        for (const id in distractedMap) {
          const wasDistracted = distractedMap[id];
          const current = next[id] || 0;
          next[id] = wasDistracted ? Math.min(stakeAmount, current + increment) : current;
        }
        return next;
      });

      // We no longer auto-transition to a VERIFYING screen; user ends session via button.

    }, UPDATE_MS);

    return () => clearInterval(interval);
  }, [gameState, sessionStartTime, wallet]);

  // Kernel (SmartSpectra) Link
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    // Removed connectKernel() as per edit hint
    // Removed onBiometricUpdate() as per edit hint
    return () => {
      // Removed off() as per edit hint
    };
  }, [gameState]);

  // Vision / Presage Loop
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let timeoutId: ReturnType<typeof setTimeout>;
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
              // Downscale and compress to reduce upload/inference latency
              canvas.width = 160; 
              canvas.height = 120;
              ctx.drawImage(video, 0, 0, 160, 120);
              const base64 = canvas.toDataURL('image/jpeg', 0.5); 
              
              const result = await processFrame(base64);
              
              // Adaptive cadence: faster checks when distracted
              nextDelay = result !== 'NONE' ? 90 : 180;
           }
         } catch (e) {
           console.error("Vision loop error:", e);
           nextDelay = 4000; // Backoff on error
         } finally {
           setIsProcessingVision(false);
         }
      }

      if (isMounted) {
        timeoutId = setTimeout(runVisionCheck, nextDelay);
      }
    };

    timeoutId = setTimeout(runVisionCheck, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [gameState]);

  // Camera Setup
  useEffect(() => {
    const startCamera = async () => {
      try {
        // Helpful diagnostics for secure context
        if (!(window as any).isSecureContext) {
          console.warn('Page is not a secure context; camera permissions may fail. Use http://localhost:3000');
        }

        // Check for available video inputs before prompting
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some((d) => d.kind === 'videoinput');
        if (!hasVideoInput) {
          throw new Error('NO_VIDEO_INPUT');
        }

        // Try with common constraints first, then fall back
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          (videoRef.current as any).srcObject = stream;
        }
      } catch (e) {
        console.error('Camera error:', e);
        const msg = (e as any)?.name || (e as any)?.message || '';
        if (msg === 'NO_VIDEO_INPUT') {
          alert('No camera detected. Please connect a webcam or enable your device camera in Windows privacy settings.');
        } else if (msg === 'NotAllowedError' || msg === 'PermissionDeniedError') {
          alert('Camera permission blocked. Click the lock icon in the address bar and allow Camera for localhost, then reload.');
        } else if (msg === 'NotFoundError' || msg === 'OverconstrainedError') {
          alert('Requested camera not found. Ensure a webcam is connected and not exclusively used by another app (Zoom/Teams), then reload.');
        } else if (msg === 'NotReadableError') {
          alert('Camera is in use by another application. Close other apps using the camera and try again.');
        } else {
          alert('Unable to access camera. Ensure you open http://localhost:3000 and allow Camera permissions, then reload.');
        }
      }
    };

    if (gameState === GameState.PLAYING || gameState === GameState.STAKING) {
      startCamera();
    }

    return () => {
      if (gameState === GameState.RESULTS) {
        streamRef.current?.getTracks().forEach(track => track.stop());
      }
    };
  }, [gameState]);

  // Handlers
  const handleConnectWallet = () => {
    setVisible(true);
  };

  const handleJoin = () => {
    if (!wallet.connected) {
      handleConnectWallet();
      return;
    }
    setGameState(GameState.STAKING);
  };

  const handleStartGame = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setTxError('Please connect your wallet first');
      return;
    }

    setIsLoadingTx(true);
    setTxError(null);

    try {
      // Start game (simulation-only, no on-chain dependency)
      const initialPlayers = [initializeSelf(), ...initializeBots()];
      setPlayers(initialPlayers);
      // Reset penalties tracking
      const zeroPenalties: Record<string, number> = {};
      initialPlayers.forEach(p => { zeroPenalties[p.id] = 0; });
      setPenalties(zeroPenalties);
      setSessionStartTime(Date.now());
      setGameState(GameState.PLAYING);
    } catch (error: any) {
      console.error('Failed to start game:', error);
      setTxError(error.message || 'Transaction failed');
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleEndSession = async () => {
    // Allow ending session without wallet
    if (isLoadingTx) return;

    setIsLoadingTx(true);
    setTxError(null);

    try {
      // Enforce minimum session duration of one hour
      if (sessionStartTime) {
        const elapsedMs = Date.now() - sessionStartTime;
        const minSessionMs = SESSION_DURATION_MINUTES * 60 * 1000;
        if (elapsedMs < minSessionMs) {
          setTxError('Minimum session is one minute (testing).');
          setIsLoadingTx(false);
          return;
        }
      }
      // Compute simulated payouts from accumulated distraction penalties and go straight to results
      const finalPlayers = [...players];
      const finalPayouts = computePayoutsFromPenalties(finalPlayers, stakeAmount, penalties);
      setPayouts(finalPayouts);
      setVerificationResult(null);
      setGameState(GameState.RESULTS);
    } catch (error: any) {
      console.error('Failed to end session:', error);
      setTxError(error.message || 'Failed to end session');
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleForfeit = async () => {
    if (!wallet.connected || !wallet.publicKey) return;

    if (!confirm('Are you sure you want to forfeit? You will lose your stake.')) {
      return;
    }

    setIsLoadingTx(true);
    setTxError(null);

    try {
      await solanaService.forfeitStake(wallet);
      setGameState(GameState.LOBBY);
    } catch (error: any) {
      console.error('Failed to forfeit:', error);
      setTxError(error.message || 'Failed to forfeit stake');
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleClaimReward = async () => {
    if (!wallet.connected || !wallet.publicKey) return;

    setIsLoadingTx(true);
    setTxError(null);

    try {
      await solanaService.claimReward(wallet);
      // Refresh balance
      const balance = await solanaService.getBalance(wallet);
      setSolBalance(balance);
      alert('Reward claimed successfully!');
    } catch (error: any) {
      console.error('Failed to claim reward:', error);
      setTxError(error.message || 'Failed to claim reward');
    } finally {
      setIsLoadingTx(false);
    }
  };

  const toggleSimulation = (type: DistractionType) => {
    if (selfBiometrics.distractionType === type) {
      setDistractionOverride('NONE');
    } else {
      setDistractionOverride(type);
    }
  };

  // Render Helpers
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatElapsedTime = (startTime: number | null) => {
    if (!startTime) return '00:00';
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return formatTime(elapsed);
  };

  const getTotalPot = () => {
    return players.length * stakeAmount;
  };

  // Views
  const renderLobby = () => (
    <section className="relative overflow-hidden pt-20 pb-16 min-h-screen">
      <div className="absolute inset-0 bg-grid-sleek opacity-70"></div>
      <div className="grid-dots"></div>
      <div className="hero-aurora"></div>
      <div className="decor-layer">
        <div className="orb orb--lg orb--purple orb--float" style={{ bottom: '-10vh', left: '-10vw' }}></div>
        <div className="orb orb--md orb--blue" style={{ top: '18vh', right: '-8vw' }}></div>
        <div className="orb orb--md orb--green orb--float" style={{ bottom: '6vh', right: '6vw' }}></div>
      </div>

      <div className="max-w-3xl mx-auto text-center px-4">
        <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple mb-6 tracking-tighter">
          FOCUS ROYALE
        </h1>
        <p className="text-gray-400/90 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
          <span>Stake SOL.</span>{' '}
          <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-neon-green via-neon-blue to-neon-purple">
            Out-focus your rivals.
          </span>{' '}
          <span>Top score takes the pot.</span>
        </p>
        <div className="mb-10">
          <span className="inline-flex pill px-5 py-2 md:px-6 md:py-2.5 rounded-full text-sm md:text-base lg:text-lg font-mono font-bold tracking-widest text-neon-purple/90">
            BET ON YOURSELF
          </span>
        </div>

        <div className="animated-border rounded-3xl mb-10 mx-auto max-w-xl">
          <div className="content glass-panel p-10 rounded-3xl relative overflow-hidden group">
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute inset-x-0 top-0 h-px bg-white/10"></div>
              <div className="absolute inset-0 translate-y-[-100%] h-full animate-scanline" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.06), transparent)' }}></div>
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl font-bold mb-4 text-white">Ready to Compete?</h2>
              {wallet.connected && wallet.publicKey && (
                <div className="mb-6 text-left bg-dark-800 p-4 rounded-lg">
                  <div className="text-sm text-gray-400 mb-2">Wallet Address</div>
                  <div className="text-xs font-mono text-neon-green break-all">{wallet.publicKey.toString()}</div>
                </div>
              )}
              <button
                onClick={handleConnectWallet}
                disabled={wallet.connected}
                className={`px-8 py-4 rounded-full font-bold text-lg transition-all flex items-center gap-2 mx-auto ${wallet.connected ? 'bg-gray-800 text-green-400 cursor-default border border-green-500' : 'btn-neo'}`}
              >
                <Wallet size={20} />
                {wallet.connected ? 'Wallet Connected' : 'Connect Wallet to Enter'}
              </button>
            </div>
          </div>
        </div>

        {wallet.connected && (
          <button
            onClick={handleJoin}
            className="w-full max-w-md mx-auto block px-8 py-4 rounded-xl font-black text-xl bg-neon-green text-black hover:bg-white transition-colors"
          >
            JOIN LOBBY
          </button>
        )}
        {txError && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
            {txError}
          </div>
        )}
      </div>
    </section>
  );

  const renderStaking = () => (
    <div className="max-w-md mx-auto pt-20 text-center">
      <div className="glass-panel p-8 rounded-2xl border border-neon-green/30">
        <ShieldCheck className="w-16 h-16 text-neon-green mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Stake Your Focus</h2>
        <p className="text-gray-400 mb-8">Stake SOL. Highest focus score wins the pot.</p>
        <div className="mb-8">
          <label className="block text-left text-sm font-mono text-gray-500 mb-2">AMOUNT (SOL)</label>
          <input 
            type="number" 
            value={stakeAmount} 
            onChange={(e) => setStakeAmount(parseFloat(e.target.value) || 0)} 
            className="w-full bg-dark-900 border border-gray-700 rounded-lg p-4 text-2xl font-mono text-white focus:border-neon-green outline-none" 
            step="0.01" 
            min="0.01"
          />
        </div>
        {escrowAccount && (
          <div className="mb-4 p-3 bg-dark-800 rounded-lg text-left">
            <div className="text-xs text-gray-400 mb-1">Current Escrow</div>
            <div className="text-sm text-white">Stake: {(escrowAccount.stakeAmount.toNumber() / 1e9).toFixed(4)} SOL</div>
            <div className="text-sm text-neon-blue">Focus Score: {escrowAccount.focusScore.toNumber()}</div>
          </div>
        )}
        <button 
          onClick={handleStartGame} 
          disabled={isLoadingTx || stakeAmount <= 0}
          className="w-full mt-8 bg-neon-blue text-black font-bold py-4 rounded-xl hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingTx ? 'Processing...' : 'LOCK IN & START'} <ArrowRight size={20} />
        </button>
        {txError && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-xs">
            {txError}
          </div>
        )}
      </div>
    </div>
  );

  const renderArena = () => (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="h-16 border-b border-gray-800 bg-dark-900 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <div className="text-neon-green font-black text-xl tracking-tighter">FOCUS ROYALE</div>
        </div>
        <div className="text-4xl font-mono font-bold text-white tracking-widest">
          {sessionStartTime ? formatElapsedTime(sessionStartTime) : '00:00'}
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
          <div className="text-neon-purple">POT: {getTotalPot().toFixed(2)} SOL</div>
          <div className="text-gray-400">Stake: {stakeAmount.toFixed(2)} SOL</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-dark-900 relative flex flex-col items-center justify-center p-8">
          {(() => {
            const currentUser = players.find(p => p.isSelf);
            if (!currentUser) return null;
            
            const isDistracted = currentUser.status !== 'FOCUS';
            const getStatusIcon = (type: string) => {
              switch (type) {
                case 'PHONE': return <Smartphone size={24} className="text-neon-red" />;
                case 'EYES_CLOSED': return <EyeOff size={24} className="text-neon-red" />;
                case 'NO_FACE': return <UserX size={24} className="text-neon-red" />;
                case 'TALKING': return <MessageCircle size={24} className="text-neon-red" />;
                case 'EATING': return <Coffee size={24} className="text-neon-red" />;
                default: return null;
              }
            };

            return (
              <div className="w-full max-w-2xl">
                <div className={`glass-panel rounded-2xl p-8 border-2 ${
                  isDistracted 
                    ? 'border-neon-red bg-neon-red/10' 
                    : 'border-neon-purple bg-neon-purple/10'
                }`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img 
                          src={currentUser.avatar} 
                          alt={currentUser.name} 
                          className={`w-20 h-20 rounded-full border-2 ${
                            isDistracted ? 'border-neon-red' : 'border-neon-purple'
                          }`}
                        />
                        {isDistracted && (
                          <div className="absolute -top-2 -right-2 bg-dark-900 rounded-full p-1.5 border-2 border-neon-red">
                            {getStatusIcon(currentUser.status)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">{currentUser.name}</h2>
                        <div className={`text-lg font-mono ${
                          isDistracted ? 'text-neon-red' : 'text-neon-green'
                        }`}>
                          {currentUser.status === 'FOCUS' ? 'FLOW STATE' : currentUser.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400 font-mono mb-1">FLOW SCORE</div>
                      <div className={`text-5xl font-mono font-bold ${
                        isDistracted ? 'text-neon-red' : 'text-neon-blue'
                      }`}>
                        {Math.floor(currentUser.flowScore)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Health/Focus Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-400 font-mono mb-2">
                      <span>FOCUS LEVEL</span>
                      <span>{Math.floor(currentUser.health)}%</span>
                    </div>
                    <div className="w-full bg-gray-900 h-4 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-200 ${
                          isDistracted ? 'bg-neon-red' : 'bg-neon-green'
                        }`}
                        style={{ width: `${Math.max(0, currentUser.health)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-dark-800 rounded-lg p-4">
                      <div className="text-xs text-gray-400 font-mono mb-1">HEART RATE</div>
                      <div className={`text-2xl font-mono font-bold ${
                        currentUser.heartRate > 100 ? 'text-neon-red animate-pulse' : 'text-white'
                      }`}>
                        {currentUser.heartRate} BPM
                      </div>
                    </div>
                    <div className="bg-dark-800 rounded-lg p-4">
                      <div className="text-xs text-gray-400 font-mono mb-1">RANK</div>
                      <div className="text-2xl font-mono font-bold text-neon-purple">
                        #{players.filter(p => p.flowScore > currentUser.flowScore).length + 1}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video Feed */}
                <div className="absolute bottom-8 right-8 w-72 h-56 bg-black rounded-lg overflow-hidden border-2 border-gray-800 shadow-2xl group">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-80" />
                  <canvas ref={canvasRef} className="hidden" />
                  <BiometricHUD data={selfBiometrics} />
                  <div className="absolute top-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] font-mono text-neon-green border border-neon-green/30">PRESAGE ACTIVE</div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                    <div className="text-[9px] text-gray-500 mb-1 font-mono uppercase text-center">Dev: Force Distraction</div>
                    <div className="flex justify-between gap-1">
                      <button onClick={() => toggleSimulation('PHONE')} className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'PHONE' ? 'bg-neon-red text-black' : 'text-gray-400'}`} title="Simulate Phone"><Smartphone size={14} /></button>
                      <button onClick={() => toggleSimulation('EATING')} className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'EATING' ? 'bg-neon-red text-black' : 'text-gray-400'}`} title="Simulate Eating"><Coffee size={14} /></button>
                      <button onClick={() => toggleSimulation('TALKING')} className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'TALKING' ? 'bg-neon-red text-black' : 'text-gray-400'}`} title="Simulate Talking"><MessageCircle size={14} /></button>
                      <button onClick={() => toggleSimulation('NO_FACE')} className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'NO_FACE' ? 'bg-neon-red text-black' : 'text-gray-400'}`} title="Simulate Missing"><UserX size={14} /></button>
                      <button onClick={() => toggleSimulation('EYES_CLOSED')} className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'EYES_CLOSED' ? 'bg-neon-red text-black' : 'text-gray-400'}`} title="Simulate Sleep"><EyeOff size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="w-80 border-l border-gray-800 bg-dark-900 p-4">
          <Leaderboard players={players} />
        </div>
      </div>

      <div className="fixed bottom-4 left-4 flex gap-2">
        <button 
          onClick={handleEndSession} 
          disabled={isLoadingTx}
          className="bg-neon-green hover:bg-neon-green/80 text-black px-4 py-2 rounded text-xs font-mono border border-neon-green disabled:opacity-50"
        >
          {isLoadingTx ? 'Processing...' : 'END SESSION'}
        </button>
        <button 
          onClick={handleForfeit} 
          disabled={isLoadingTx}
          className="bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded text-xs font-mono border border-red-500 disabled:opacity-50"
        >
          FORFEIT
        </button>
      </div>
      {sessionStartTime && ((Date.now() - sessionStartTime) < (SESSION_DURATION_MINUTES * 60 * 1000)) && (
        <div className="fixed bottom-4 left-4 translate-y-10 text-gray-400 text-[10px] font-mono">
          Minimum session is one minute (testing). Time remaining: {
            (() => {
              const remaining = (SESSION_DURATION_MINUTES * 60 * 1000) - (Date.now() - sessionStartTime);
              const secs = Math.max(0, Math.ceil(remaining / 1000));
              const m = Math.floor(secs / 60);
              const s = secs % 60;
              return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            })()
          }
        </div>
      )}
      {txError && (
        <div className="fixed bottom-4 right-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-xs max-w-sm">
          {txError}
        </div>
      )}
    </div>
  );

  // Verification view (simulation mode): return null to keep UI snappy if referenced
  const renderVerifying = () => null;

  const renderResults = () => {
    const winner = [...players].sort((a, b) => b.flowScore - a.flowScore)[0] || initializeSelf();
    const isWinner = winner.isSelf;
    const pot = getTotalPot();
    const winnerPayout = payouts ? payouts[winner.id] : pot;
    return (
      <div className="min-h-screen bg-dark-900 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-white mb-2">SESSION COMPLETE</h1>
            <div className="text-neon-purple font-mono text-xl">POT DISTRIBUTED (SIMULATED)</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-panel p-8 rounded-2xl border border-gray-700">
              <h3 className="text-neon-blue font-bold mb-6 flex items-center gap-2"><Eye size={20} /> SESSION SUMMARY</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-gray-500 font-mono">RULES APPLIED</label>
                  <p className="text-gray-300 mt-2 text-sm">
                    Distracted time converted into penalties from each player’s stake.
                    Penalty pool was split equally among the top performer(s) by focus score.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-mono">NOTES</label>
                  <p className="text-gray-400 text-xs mt-2">
                    This is a simulation only. No on-chain transfers occurred.
                  </p>
                </div>
              </div>
            </div>
            <div className={`glass-panel p-8 rounded-2xl border-2 relative overflow-hidden ${isWinner ? 'border-neon-green' : 'border-gray-700'}`}>
              {isWinner && (<div className="absolute top-0 right-0 bg-neon-green text-black font-bold px-4 py-1 text-sm">YOU WON</div>)}
              <div className="flex flex-col items-center text-center pt-4">
                <img src={winner.avatar} className="w-24 h-24 rounded-full border-4 border-white mb-4" />
                <h2 className="text-2xl font-bold text-white mb-1">{winner.name}</h2>
                <p className="text-gray-400 font-mono text-sm mb-6">Total Flow Score: {Math.floor(winner.flowScore)}</p>
                <div className="bg-dark-800 rounded-xl p-6 w-full">
                  <div className="text-gray-500 text-sm mb-1">Payout</div>
                  <div className="text-4xl font-mono font-bold text-neon-green">{winnerPayout.toFixed(2)} SOL</div>
                  <div className="mt-2 text-xs text-gray-400 font-mono">Simulated distribution only. No on-chain transfer.</div>
                  <div className="mt-4">
                    <div className="text-gray-400 text-xs font-mono mb-2">Distribution</div>
                    <div className="space-y-2">
                      {players.map(p => (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className={`font-mono ${p.isSelf ? 'text-neon-blue' : 'text-gray-300'}`}>
                            {p.name} {p.status !== 'FOCUS' ? '(distracted)' : ''}
                          </span>
                          <div className="flex items-center gap-6">
                            <span className="font-mono text-gray-400">Score: {Math.floor(p.flowScore)}</span>
                            <span className="font-mono text-white">{(payouts ? payouts[p.id] : stakeAmount).toFixed(2)} SOL</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-12">
            <button onClick={() => { setGameState(GameState.LOBBY); }} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto">
              <RefreshCcw size={18} /> RETURN TO LOBBY
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-neon-green selection:text-black">
      {gameState === GameState.LOBBY && renderLobby()}
      {gameState === GameState.STAKING && renderStaking()}
      {gameState === GameState.PLAYING && renderArena()}
      {gameState === GameState.VERIFYING && renderVerifying()}
      {gameState === GameState.RESULTS && renderResults()}
    </div>
  );
}