
import React from 'react';
import { Player, DistractionType } from '../types';
import { Smartphone, EyeOff, UserX, MessageCircle, Coffee, Activity } from 'lucide-react';

interface LeaderboardProps {
  players: Player[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ players }) => {
  // Sort by flow score descending
  const sortedPlayers = [...players].sort((a, b) => b.flowScore - a.flowScore);

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'PHONE': return <Smartphone size={12} className="text-neon-red" />;
      case 'EYES_CLOSED': return <EyeOff size={12} className="text-neon-red" />;
      case 'NO_FACE': return <UserX size={12} className="text-neon-red" />;
      case 'TALKING': return <MessageCircle size={12} className="text-neon-red" />;
      case 'EATING': return <Coffee size={12} className="text-neon-red" />;
      case 'PANIC': return <Activity size={12} className="text-neon-red" />;
      default: return null;
    }
  };

  return (
    <div className="glass-panel rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-neon-green font-mono text-sm mb-4 flex items-center justify-between">
        <span className="flex items-center">
           <span className="w-2 h-2 bg-neon-green rounded-full mr-2 animate-pulse"></span>
           LIVE DATA
        </span>
        <span className="text-[10px] text-gray-500">REFRESH: 100ms</span>
      </h3>
      <div className="space-y-3">
        {sortedPlayers.map((player, idx) => {
           const isDistracted = player.status !== 'FOCUS';
           
           return (
            <div 
              key={player.id} 
              className={`relative p-3 rounded-lg border transition-all duration-300 ${
                player.isSelf 
                  ? 'border-neon-purple bg-neon-purple/10' 
                  : 'border-gray-800 bg-dark-800'
              } ${isDistracted && player.isSelf ? 'border-neon-red bg-neon-red/10' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-mono text-xs">#{idx + 1}</span>
                  <div className="relative">
                    <img 
                      src={player.avatar} 
                      alt={player.name} 
                      className={`w-8 h-8 rounded-full border ${isDistracted ? 'border-neon-red' : 'border-gray-600'}`}
                    />
                    {isDistracted && (
                      <div className="absolute -top-1 -right-1 bg-dark-900 rounded-full p-0.5 border border-neon-red">
                         {getStatusIcon(player.status)}
                      </div>
                    )}
                  </div>
                  <span className={`font-semibold text-sm truncate max-w-[100px] ${player.isSelf ? 'text-white' : 'text-gray-300'}`}>
                    {player.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-bold text-sm ${isDistracted ? 'text-neon-red' : 'text-neon-blue'}`}>
                    {Math.floor(player.flowScore)}
                  </div>
                </div>
              </div>
              
              {/* Health/Focus Bar */}
              <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${
                    isDistracted ? 'bg-neon-red' : 'bg-neon-green'
                  }`}
                  style={{ width: `${Math.max(0, player.health)}%` }}
                ></div>
              </div>

              {/* Status Indicators */}
              <div className="mt-2 flex justify-between text-[10px] font-mono text-gray-400 items-center">
                <span className={player.heartRate > 100 ? 'text-neon-red animate-pulse' : ''}>
                  HR: {player.heartRate}
                </span>
                <span className={isDistracted ? 'text-neon-red font-bold' : 'text-neon-green'}>
                  {player.status === 'FOCUS' ? 'FLOW STATE' : player.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
