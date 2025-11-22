import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.PRESAGE_API_KEY': JSON.stringify(env.PRESAGE_API_KEY),
        'process.env.GEMINI_MODEL': JSON.stringify(env.GEMINI_MODEL || 'gemini-2.0-flash-lite'),
        'process.env.KERNEL_URL': JSON.stringify(env.KERNEL_URL || 'http://localhost:3001'),
        // Vision cadence controls (ms)
        'process.env.GEMINI_INTERVAL_DISTRACTED': JSON.stringify(env.GEMINI_INTERVAL_DISTRACTED || '100'),
        'process.env.GEMINI_INTERVAL_FOCUS': JSON.stringify(env.GEMINI_INTERVAL_FOCUS || '180'),
        // Smoothing thresholds (ms)
        'process.env.SMOOTH_EYES_CLOSED_MS': JSON.stringify(env.SMOOTH_EYES_CLOSED_MS || '1200'),
        'process.env.SMOOTH_NO_FACE_MS': JSON.stringify(env.SMOOTH_NO_FACE_MS || '400'),
        'process.env.SMOOTH_OTHER_MS': JSON.stringify(env.SMOOTH_OTHER_MS || '250'),
        'process.env.SMOOTH_RECOVERY_MS': JSON.stringify(env.SMOOTH_RECOVERY_MS || '200')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
