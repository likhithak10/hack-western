import { io, Socket } from 'socket.io-client';
import { BiometricData, DistractionType, Player } from '../types';

const SERVER_URL = 'http://localhost:3001';
const PRESAGE_API_KEY = '2BwfYdU0gG7QXEEi8wIwD1FUgpUWhd3y5A30zGb8';

class SocketService {
  private socket: Socket | null = null;
  private biometricCallback: ((data: Partial<BiometricData>) => void) | null = null;
  private lobbyCallback: ((players: Player[]) => void) | null = null;

  connect() {
    if (this.socket) return;

    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      query: {
        apiKey: PRESAGE_API_KEY, // Authentication for Presage/SmartSpectra Backend
        clientType: 'FRONTEND'
      },
      reconnectionAttempts: 5,
      timeout: 5000
    });

    this.socket.on('connect', () => {
      console.log('Connected to Presage Core Backend');
    });

    this.socket.on('biometric_update', (data: any) => {
      // Expecting backend to send { status: string, heartRate: number, gazeStability: number }
      if (this.biometricCallback) {
        this.biometricCallback(this.mapBackendDataToFrontend(data));
      }
    });

    this.socket.on('lobby_state', (players: Player[]) => {
      if (this.lobbyCallback) {
        this.lobbyCallback(players);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Stream video frame to C++ Backend for analysis
  sendFrame(base64Frame: string) {
    if (this.socket?.connected) {
      // Strip header if present to send raw bytes/string
      const cleanData = base64Frame.split(',')[1] || base64Frame;
      this.socket.emit('stream_frame', { 
        timestamp: Date.now(), 
        data: cleanData 
      });
      return true;
    }
    return false;
  }

  joinLobby(player: Partial<Player>) {
    this.socket?.emit('join_lobby', player);
  }

  onBiometricUpdate(cb: (data: Partial<BiometricData>) => void) {
    this.biometricCallback = cb;
  }

  onLobbyUpdate(cb: (players: Player[]) => void) {
    this.lobbyCallback = cb;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  private mapBackendDataToFrontend(data: any): Partial<BiometricData> {
    // Map backend strings to our DistractionType enum
    let distraction: DistractionType = 'NONE';
    const status = (data.status || 'FOCUS').toUpperCase();
    
    if (status.includes('PHONE')) distraction = 'PHONE';
    else if (status.includes('EAT')) distraction = 'EATING';
    else if (status.includes('TALK')) distraction = 'TALKING';
    else if (status.includes('SLEEP') || status.includes('EYES')) distraction = 'EYES_CLOSED';
    else if (status.includes('ABSENT') || status.includes('NO_FACE')) distraction = 'NO_FACE';
    
    return {
      heartRate: data.heartRate || 70,
      gazeStability: data.gazeStability || 100,
      distractionType: distraction
    };
  }
}

export const socketService = new SocketService();
