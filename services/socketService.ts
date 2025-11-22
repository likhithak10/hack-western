import { io, Socket } from 'socket.io-client';
import { DistractionType } from '../types';

type KernelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

let socket: Socket | null = null;
let status: KernelStatus = 'disconnected';
let statusListeners: Array<(s: KernelStatus) => void> = [];
let bioListeners: Array<(payload: any) => void> = [];

function notifyStatus(newStatus: KernelStatus) {
  status = newStatus;
  statusListeners.forEach((cb) => {
    try { cb(status); } catch {}
  });
}

export function connectKernel(options?: { url?: string; apiKey?: string }) {
  if (socket && socket.connected) return;

  const url = options?.url || (process.env.KERNEL_URL as string) || 'http://localhost:3001';
  const apiKey = options?.apiKey || (process.env.PRESAGE_API_KEY as string) || '';

  notifyStatus('connecting');
  socket = io(url, {
    transports: ['websocket'],
    query: { apiKey },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    notifyStatus('connected');
  });
  socket.on('connect_error', () => {
    notifyStatus('error');
  });
  socket.on('disconnect', () => {
    notifyStatus('disconnected');
  });

  socket.on('biometric_update', (payload: any) => {
    bioListeners.forEach((cb) => {
      try { cb(payload); } catch {}
    });
  });
}

export function isKernelConnected(): boolean {
  return Boolean(socket && socket.connected);
}

export function onKernelStatusChange(cb: (status: KernelStatus) => void) {
  statusListeners.push(cb);
  return () => {
    statusListeners = statusListeners.filter((f) => f !== cb);
  };
}

export function onBiometricUpdate(cb: (payload: any) => void) {
  bioListeners.push(cb);
  return () => {
    bioListeners = bioListeners.filter((f) => f !== cb);
  };
}

export function sendFrameToKernel(base64Image: string) {
  if (!socket || !socket.connected) return;
  const clean = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  socket.emit('stream_frame', {
    timestamp: Date.now(),
    data: clean,
  });
}

export function mapKernelStatusToDistractionType(status: string | undefined): DistractionType {
  switch (status) {
    case 'PHONE':
    case 'EATING':
    case 'TALKING':
    case 'EYES_CLOSED':
    case 'NO_FACE':
      return status;
    case 'FOCUS':
    case 'NONE':
    default:
      return 'NONE';
  }
}


