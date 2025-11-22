
import React, { useEffect, useRef } from 'react';
import { BiometricData, DistractionType } from '../types';
import { AlertTriangle, Smartphone, EyeOff, UserX, MessageCircle, Coffee } from 'lucide-react';

interface BiometricHUDProps {
  data: BiometricData;
}

export const BiometricHUD: React.FC<BiometricHUDProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Dynamic Color based on state
      const isDistracted = data.distractionType !== 'NONE';
      const primaryColor = isDistracted ? '#ff0055' : '#00ff9d';
      
      // Draw Face Mesh / Reticle Simulation
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5;

      if (data.distractionType !== 'NO_FACE') {
        // Draw artificial "face landmarks"
        const time = Date.now() / 1000;
        const breathe = Math.sin(time * 2) * 2;
        
        // Box corners
        const boxSize = 80 + breathe;
        const x = centerX;
        const y = centerY;
        
        // Reticle corners
        ctx.beginPath();
        // Top Left
        ctx.moveTo(x - boxSize, y - boxSize + 20);
        ctx.lineTo(x - boxSize, y - boxSize);
        ctx.lineTo(x - boxSize + 20, y - boxSize);
        // Top Right
        ctx.moveTo(x + boxSize - 20, y - boxSize);
        ctx.lineTo(x + boxSize, y - boxSize);
        ctx.lineTo(x + boxSize, y - boxSize + 20);
        // Bottom Right
        ctx.moveTo(x + boxSize, y + boxSize - 20);
        ctx.lineTo(x + boxSize, y + boxSize);
        ctx.lineTo(x + boxSize - 20, y + boxSize);
        // Bottom Left
        ctx.moveTo(x - boxSize + 20, y + boxSize);
        ctx.lineTo(x - boxSize, y + boxSize);
        ctx.lineTo(x - boxSize, y + boxSize - 20);
        ctx.stroke();

        // Eyes (Simulated Gaze)
        const gazeX = (Math.random() - 0.5) * (100 - data.gazeStability);
        const gazeY = (Math.random() - 0.5) * (100 - data.gazeStability);
        
        if (data.distractionType !== 'EYES_CLOSED') {
          ctx.strokeRect(x - 30 + gazeX, y - 20 + gazeY, 20, 10); // Left eye
          ctx.strokeRect(x + 10 + gazeX, y - 20 + gazeY, 20, 10); // Right eye
        } else {
          // Closed eyes
          ctx.beginPath();
          ctx.moveTo(x - 30, y - 15); ctx.lineTo(x - 10, y - 15);
          ctx.moveTo(x + 10, y - 15); ctx.lineTo(x + 30, y - 15);
          ctx.stroke();
        }
      }

      // Data Readout
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = primaryColor;
      ctx.fillText(`GAZE: ${data.gazeStability.toFixed(1)}%`, 10, canvas.height - 25);
      ctx.fillText(`HR: ${data.heartRate} BPM`, 10, canvas.height - 10);
      ctx.fillText(`STAB: ${data.distractionType === 'NONE' ? 'HIGH' : 'LOW'}`, 100, canvas.height - 10);

      // Scanning Line Animation
      if (!isDistracted) {
        const scanY = (Date.now() % 2000) / 2000 * canvas.height;
        ctx.fillStyle = 'rgba(0, 255, 157, 0.1)';
        ctx.fillRect(0, scanY, canvas.width, 2);
      } else {
        // Red Pulse Background for Distraction
        if (Math.floor(Date.now() / 200) % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 0, 85, 0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [data]);

  // Icon Helper
  const getIcon = () => {
    switch (data.distractionType) {
      case 'PHONE': return <Smartphone className="w-8 h-8 text-neon-red animate-bounce" />;
      case 'EYES_CLOSED': return <EyeOff className="w-8 h-8 text-neon-red" />;
      case 'NO_FACE': return <UserX className="w-8 h-8 text-neon-red" />;
      case 'TALKING': return <MessageCircle className="w-8 h-8 text-neon-red" />;
      case 'EATING': return <Coffee className="w-8 h-8 text-neon-red" />;
      default: return null;
    }
  };

  const getMessage = () => {
    switch (data.distractionType) {
      case 'PHONE': return "PHONE DETECTED";
      case 'EYES_CLOSED': return "WAKE UP!";
      case 'NO_FACE': return "USER MISSING";
      case 'TALKING': return "NO TALKING";
      case 'EATING': return "NO EATING";
      default: return null;
    }
  };

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={240} 
        className="absolute top-0 left-0 w-full h-full object-cover z-10 pointer-events-none"
      />
      
      {/* Overlay Warning */}
      {data.distractionType !== 'NONE' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm border-2 border-neon-red m-1 animate-pulse-fast">
          {getIcon()}
          <span className="text-neon-red font-black font-mono text-xl mt-2 tracking-widest bg-black px-2">
            {getMessage()}
          </span>
          <span className="text-neon-red font-mono text-xs mt-1">- PENALTY ACTIVE -</span>
        </div>
      )}
    </div>
  );
};
