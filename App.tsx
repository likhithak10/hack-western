
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, BiometricData, DistractionType } from './types';
import { getBiometrics, setDistractionOverride, setAIState, startPresageMeasurement, processFrameForHeartRate } from './services/presageService';
import { verifyWork, analyzeUserStatus } from './services/geminiService';
import { Leaderboard } from './components/Leaderboard';
import { BiometricHUD } from './components/BiometricHUD';
import BrainVisualizer from './components/BrainVisualizer';
import { ArrowRight, ShieldCheck, Eye, RefreshCcw, Smartphone, Coffee, MessageCircle, UserX, EyeOff, Play, Pause } from 'lucide-react';

const TOTAL_TIME = 25 * 60; // 25 minutes in seconds
const BOT_NAMES = ["ApexFocus", "DeepWorker99", "FlowState_Chad", "CryptoNomad", "ZenMaster"];
const UPDATE_MS = 100; // 10hz update rate for animation
const INITIAL_VISION_DELAY_MS = 200; // Start very fast for immediate detection

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for frame capture
  
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

  // Main Game Loop (Biometrics + Bots)
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const interval = setInterval(async () => {
      // 1. Update Self (Physics & State)
      const isTabFocused = document.visibilityState === 'visible';
      // Note: simulateBiometrics now pulls from the shared state which is updated by the Vision Loop
      const newBiometrics = await getBiometrics(true, isTabFocused);

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
            // Simulate Bots
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

            // Apply Bot Deltas
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

  // Vision Check Loop (Recursive Timeout)
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const runVisionCheck = async () => {
      if (!isMounted) return;

      // Default safe delay
      let nextDelay = INITIAL_VISION_DELAY_MS;

      if (videoRef.current && canvasRef.current && !isProcessingVision) {
         setIsProcessingVision(true);
         try {
           // Capture Frame
           const video = videoRef.current;
           const canvas = canvasRef.current;
           const ctx = canvas.getContext('2d');
           
           if (ctx && video.videoWidth > 0) {
              // Higher resolution for better detection (especially for mouth/eyes)
              canvas.width = 640; 
              canvas.height = 480;
              // Higher quality for better detection
              ctx.drawImage(video, 0, 0, 640, 480);
              const base64 = canvas.toDataURL('image/jpeg', 0.9); 
              
              // Send to Gemini for distraction detection
              // Also send frame to Presage for heart rate detection (async, don't wait)
              processFrameForHeartRate(base64, Date.now()).catch(err => {
                console.error('Presage heart rate processing error:', err);
              });
              
              const result = await analyzeUserStatus(base64);
              
              // --- SMOOTHING LOGIC ---
              // We buffer 'NO_FACE' and 'EYES_CLOSED' to prevent false positives from a single glitchy frame.
              // 'PHONE', 'EATING', and 'TALKING' are instant (high confidence).
              
              const prev = lastDetectionRef.current;
              let confirmedState: DistractionType = 'NONE';

              if (result === 'NONE') {
                // Always forgive immediately if focus returns
                confirmedState = 'NONE';
              } else if (result === 'PHONE' || result === 'EATING' || result === 'TALKING') {
                 // High confidence objects, detect instantly
                 confirmedState = result;
                 // Debug logging
                 if (result === 'TALKING') {
                   console.log('✅ TALKING confirmed and set');
                 } else if (result === 'EATING') {
                   console.log('✅ EATING confirmed and set');
                 }
              } else if (result === 'EYES_CLOSED') {
                 // Eyes closed - faster confirmation (only need 1-2 frames)
                 // If we see it once and it's sustained, or if we were already in this state, confirm it
                 if (prev === 'EYES_CLOSED') {
                    confirmedState = result;
                    console.log('✅ EYES_CLOSED confirmed (sustained)');
                 } else {
                    // First detection - apply immediately but will need next frame to sustain
                    confirmedState = result;
                    console.log('⏳ EYES_CLOSED detected, applying immediately');
                 }
              } else {
                 // 'NO_FACE' - prone to error, needs confirmation
                 if (prev === result) {
                    confirmedState = result;
                 } else {
                    confirmedState = prev || 'NONE';
                 }
              }
              
              setAIState(confirmedState);
              lastDetectionRef.current = confirmedState === 'NONE' ? result : confirmedState;
              
              // Log state changes
              if (confirmedState !== prev && confirmedState !== 'NONE') {
                console.log(`🔄 State changed: ${prev} → ${confirmedState}`);
              } 
              
              // --- ADAPTIVE POLLING ---
              // If the user is currently penalized (Distracted), poll FASTER to release them ASAP.
              // If the user is Focused, poll SLOWER to save API quota.
              if (confirmedState !== 'NONE') {
                nextDelay = 150; // Very aggressive check to clear penalty - faster response
              } else {
                nextDelay = 300; // Fast monitoring - detect changes quickly
              }
           }
         } catch (e) {
           console.error("Vision loop error:", e);
           // Back off on error to prevent 429 loops
           nextDelay = 4000;
         } finally {
           setIsProcessingVision(false);
         }
      }

      if (isMounted) {
        timeoutId = setTimeout(runVisionCheck, nextDelay);
      }
    };

    // Start the loop
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Camera error:", e);
        alert("Camera permission is required for biometric verification.");
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

  // --- Handlers ---

  const handleJoin = () => {
    if (!walletConnected) return;
    setGameState(GameState.STAKING);
  };

  const handleStartGame = () => {
    startPresageMeasurement(); // Initialize Presage heart rate detection
    setPlayers([initializeSelf(), ...initializeBots()]);
    setGameState(GameState.PLAYING);
  };

  const handleVerify = async () => {
    setGameState(GameState.VERIFYING);
    const result = await verifyWork(workContent);
    
    setVerificationResult(result);
    
    setPlayers(prev => prev.map(p => {
      if (p.isSelf) {
        return { ...p, flowScore: p.flowScore + (result.score * 2) }; 
      }
      return p;
    }));

    setGameState(GameState.RESULTS);
  };

  const toggleSimulation = (type: DistractionType) => {
    if (selfBiometrics.distractionType === type) {
      setDistractionOverride('NONE');
    } else {
      setDistractionOverride(type);
    }
  };

  // --- Render Helpers ---

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Views ---

  const renderLobby = () => (
    <div className="max-w-2xl mx-auto text-center pt-20 px-4">
      <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-neon-blue mb-6 tracking-tighter">
        FOCUS ROYALE
      </h1>
      <p className="text-gray-400 text-xl mb-12 max-w-lg mx-auto">
        The multiplayer battle royale for productivity. Stake SOL, maintain deep work, 
        and let biometrics prove your flow state.
      </p>
      
      <div className="glass-panel p-8 rounded-2xl mb-8 border border-neon-purple/30 relative overflow-hidden group">
        <div className="absolute inset-0 bg-neon-purple/5 group-hover:bg-neon-purple/10 transition-colors duration-500"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-4 text-white">Next Lobby Starting In...</h2>
          <div className="text-5xl font-mono font-bold text-neon-green mb-8">
            00:45
          </div>
          
          <button 
            onClick={() => setWalletConnected(true)}
            disabled={walletConnected}
            className={`
              px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105
              ${walletConnected 
                ? 'bg-gray-800 text-green-400 cursor-default border border-green-500' 
                : 'bg-neon-purple text-white shadow-[0_0_30px_rgba(188,19,254,0.4)] hover:shadow-[0_0_50px_rgba(188,19,254,0.6)]'}
            `}
          >
            {walletConnected ? 'Phantom Wallet Connected' : 'Connect Wallet to Enter'}
          </button>
        </div>
      </div>

      {walletConnected && (
         <button 
         onClick={handleJoin}
         className="w-full max-w-md mx-auto block px-8 py-4 bg-neon-green text-black font-black text-xl rounded-xl hover:bg-white transition-colors"
       >
         JOIN LOBBY
       </button>
      )}
    </div>
  );

  const renderStaking = () => (
    <div className="max-w-md mx-auto pt-20 text-center">
      <div className="glass-panel p-8 rounded-2xl border border-neon-green/30">
        <ShieldCheck className="w-16 h-16 text-neon-green mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Stake Your Focus</h2>
        <p className="text-gray-400 mb-8">
          Commit funds to the smart contract. If your flow score drops below the threshold, you lose your stake.
        </p>

        <div className="mb-8">
          <label className="block text-left text-sm font-mono text-gray-500 mb-2">AMOUNT (SOL)</label>
          <input 
            type="number" 
            value={stakeAmount}
            onChange={(e) => setStakeAmount(parseFloat(e.target.value))}
            className="w-full bg-dark-900 border border-gray-700 rounded-lg p-4 text-2xl font-mono text-white focus:border-neon-green outline-none"
            step="0.1"
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Pot Size</span>
            <span className="text-neon-green font-mono">{(stakeAmount * 6).toFixed(2)} SOL</span>
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>Competitors</span>
            <span className="text-white font-mono">6</span>
          </div>
        </div>

        <button 
          onClick={handleStartGame}
          className="w-full mt-8 bg-neon-blue text-black font-bold py-4 rounded-xl hover:bg-white transition-colors flex items-center justify-center gap-2"
        >
          LOCK IN & START <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderArena = () => (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="h-16 border-b border-gray-800 bg-dark-900 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <div className="text-neon-green font-black text-xl tracking-tighter">FOCUS ROYALE</div>
          <div className="bg-dark-800 px-3 py-1 rounded border border-gray-700 flex items-center gap-2 text-xs font-mono text-gray-400">
            <div className={`w-2 h-2 rounded-full ${isProcessingVision ? 'bg-neon-blue animate-ping' : 'bg-red-500 animate-pulse'}`}></div>
            {isProcessingVision ? 'ANALYZING FRAMES...' : 'LIVE MONITORING'}
          </div>
        </div>
        <div className="text-4xl font-mono font-bold text-white tracking-widest">
          {formatTime(timeLeft)}
        </div>
        <div className="flex items-center gap-4 text-sm font-mono">
           <div className="text-neon-purple">POT: {(stakeAmount * 6).toFixed(2)} SOL</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Brain Visualizer - Center */}
        <div className="flex-1 bg-dark-900 relative flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-neon-purple font-bold text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} /> Brain Activity
            </h3>
          </div>
          <div className="flex-1 relative">
            <BrainVisualizer biometrics={selfBiometrics} className="absolute inset-0" />
          </div>

          {/* Self Camera Preview */}
          <div className="absolute bottom-8 right-8 w-72 h-56 bg-black rounded-lg overflow-hidden border-2 border-gray-800 shadow-2xl group z-10">
             <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                className="w-full h-full object-cover opacity-80"
             />
             {/* Hidden Canvas for frame processing */}
             <canvas ref={canvasRef} className="hidden" />

             {/* Presage Overlay */}
             <BiometricHUD data={selfBiometrics} />
             <div className="absolute top-2 left-2 bg-black/50 px-2 py-0.5 rounded text-[10px] font-mono text-neon-green border border-neon-green/30">
               PRESAGE ACTIVE
             </div>

             {/* Developer Simulation Controls (Now optional / override) */}
             <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                <div className="text-[9px] text-gray-500 mb-1 font-mono uppercase text-center">Dev: Force Distraction (Overrides AI)</div>
                <div className="flex justify-between gap-1">
                  <button 
                    onClick={() => toggleSimulation('PHONE')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'PHONE' ? 'bg-neon-red text-black' : 'text-gray-400'}`}
                    title="Simulate Phone Usage"
                  ><Smartphone size={14} /></button>
                  <button 
                    onClick={() => toggleSimulation('EATING')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'EATING' ? 'bg-neon-red text-black' : 'text-gray-400'}`}
                    title="Simulate Eating"
                  ><Coffee size={14} /></button>
                  <button 
                    onClick={() => toggleSimulation('TALKING')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'TALKING' ? 'bg-neon-red text-black' : 'text-gray-400'}`}
                    title="Simulate Talking"
                  ><MessageCircle size={14} /></button>
                  <button 
                    onClick={() => toggleSimulation('NO_FACE')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'NO_FACE' ? 'bg-neon-red text-black' : 'text-gray-400'}`}
                    title="Simulate Missing User"
                  ><UserX size={14} /></button>
                  <button 
                    onClick={() => toggleSimulation('EYES_CLOSED')}
                    className={`p-1.5 rounded hover:bg-gray-700 ${selfBiometrics.distractionType === 'EYES_CLOSED' ? 'bg-neon-red text-black' : 'text-gray-400'}`}
                    title="Simulate Sleep/Closed Eyes"
                  ><EyeOff size={14} /></button>
                </div>
             </div>
          </div>
        </div>

        <div className="w-80 border-l border-gray-800 bg-dark-900 p-4">
          <Leaderboard players={players} />
        </div>
      </div>
      
      <div className="fixed bottom-4 left-4">
        <button 
          onClick={handleVerify} 
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-xs font-mono border border-gray-600"
        >
          FINISH SESSION EARLY
        </button>
      </div>
    </div>
  );

  const renderVerifying = () => (
    <div className="h-screen flex flex-col items-center justify-center bg-dark-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="z-10 text-center">
        <div className="w-24 h-24 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
        <h2 className="text-3xl font-bold text-white mb-4">Gemini is Verifying Proof of Work...</h2>
        <p className="text-gray-400 max-w-md mx-auto animate-pulse">
          Analyzing semantic density, code coherence, and biometric logs...
        </p>
      </div>
    </div>
  );

  const renderResults = () => {
    const winner = players.sort((a, b) => b.flowScore - a.flowScore)[0];
    const isWinner = winner.isSelf;

    return (
      <div className="min-h-screen bg-dark-900 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
             <h1 className="text-5xl font-black text-white mb-2">SESSION COMPLETE</h1>
             <div className="text-neon-purple font-mono text-xl">POT DISTRIBUTED</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="glass-panel p-8 rounded-2xl border border-gray-700">
               <h3 className="text-neon-blue font-bold mb-6 flex items-center gap-2">
                 <Eye size={20} /> GEMINI AUDIT REPORT
               </h3>
               
               <div className="space-y-6">
                  <div>
                    <label className="text-xs text-gray-500 font-mono">PRODUCTIVITY SCORE</label>
                    <div className="text-4xl font-bold text-white">{verificationResult?.score || 0}/100</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-mono">AI COMMENTARY</label>
                    <p className="text-gray-300 italic border-l-2 border-neon-blue pl-4 mt-2">
                      "{verificationResult?.comment}"
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-mono">BIOMETRIC INTEGRITY</label>
                    <div className="text-green-400 mt-1 flex items-center gap-2">
                      <ShieldCheck size={16} /> VERIFIED (Presage)
                    </div>
                  </div>
               </div>
            </div>

            <div className={`glass-panel p-8 rounded-2xl border-2 relative overflow-hidden ${isWinner ? 'border-neon-green' : 'border-gray-700'}`}>
              {isWinner && (
                <div className="absolute top-0 right-0 bg-neon-green text-black font-bold px-4 py-1 text-sm">
                  YOU WON
                </div>
              )}
              
              <div className="flex flex-col items-center text-center pt-4">
                <img src={winner.avatar} className="w-24 h-24 rounded-full border-4 border-white mb-4" alt="Winner" />
                <h2 className="text-2xl font-bold text-white mb-1">{winner.name}</h2>
                <p className="text-gray-400 font-mono text-sm mb-6">Total Flow Score: {Math.floor(winner.flowScore)}</p>
                
                <div className="bg-dark-800 rounded-xl p-6 w-full">
                  <div className="text-gray-500 text-sm mb-1">Payout</div>
                  <div className="text-4xl font-mono font-bold text-neon-green">
                    {(stakeAmount * 6).toFixed(2)} SOL
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="text-center mt-12">
            <button 
              onClick={() => {
                setGameState(GameState.LOBBY);
                setWorkContent("");
              }}
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto"
            >
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
