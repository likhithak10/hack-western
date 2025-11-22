'use strict';

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const SMART_SPECTRA_PATH = process.env.SMART_SPECTRA_PATH || './path/to/smart_spectra_cli';
const SMART_SPECTRA_ARGS = (process.env.SMART_SPECTRA_ARGS || '--analyze').split(' ').filter(Boolean);

const app = express();
const server = http.createServer(app);

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, mode: 'relay', kernel: Boolean(SMART_SPECTRA_PATH) });
});

// Socket.io for realtime bridge
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  const apiKey = socket.handshake.query?.apiKey;
  console.log(`Client connected: ${socket.id}${apiKey ? ` | Key: ${apiKey}` : ''}`);

  // Drop-oldest queue: only process latest frame to avoid backpressure at 20Hz
  let isProcessing = false;
  let latestPending = null;

  const handleNext = () => {
    if (!latestPending) return;
    const payload = latestPending;
    latestPending = null;
    processFrame(payload)
      .catch((err) => {
        console.error('Frame processing error:', err?.message || err);
        socket.emit('biometric_update', { status: 'ERROR', error: 'processing_failed' });
      })
      .finally(() => {
        if (latestPending) {
          // Process the newest pending frame, drop any stale ones
          handleNext();
        } else {
          isProcessing = false;
        }
      });
  };

  socket.on('stream_frame', (payload) => {
    // payload = { timestamp: number, data: base64string }
    latestPending = payload;
    if (!isProcessing) {
      isProcessing = true;
      handleNext();
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  /**
   * Spawns the SmartSpectra CLI, writes base64 frame to STDIN, and emits parsed result.
   */
  function processFrame(payload) {
    return new Promise((resolve, reject) => {
      if (!payload || !payload.data) {
        socket.emit('biometric_update', { status: 'ERROR', error: 'invalid_payload' });
        return resolve();
      }

      // Spawn per-frame (works with simple CLI). For higher perf, prefer a long-lived process/protocol.
      const child = spawn(SMART_SPECTRA_PATH, SMART_SPECTRA_ARGS, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdoutBuf = '';
      let stderrBuf = '';
      let settled = false;

      const settle = (fn) => (value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const resolveOnce = settle(resolve);
      const rejectOnce = settle(reject);

      // Safety timeout (3s)
      const timeoutMs = Number(process.env.CLI_TIMEOUT_MS || 3000);
      const t = setTimeout(() => {
        try {
          child.kill();
        } catch {}
        console.warn('SmartSpectra timed out');
        socket.emit('biometric_update', { status: 'ERROR', error: 'timeout' });
        resolveOnce();
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutBuf += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(t);
        console.error('Failed to spawn SmartSpectra:', err?.message || err);
        socket.emit('biometric_update', { status: 'ERROR', error: 'spawn_failed' });
        resolveOnce();
      });

      child.on('close', () => {
        clearTimeout(t);
        if (stderrBuf) {
          console.warn('SmartSpectra stderr:', stderrBuf.trim());
        }

        // Try to parse last valid JSON from stdout
        const text = stdoutBuf.trim();
        let parsed = null;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            // Attempt to find a JSON object in mixed output
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
              const candidate = text.slice(start, end + 1);
              try {
                parsed = JSON.parse(candidate);
              } catch {}
            }
          }
        }

        if (parsed) {
          socket.emit('biometric_update', parsed);
        } else {
          socket.emit('biometric_update', { status: 'ERROR', error: 'invalid_output' });
        }
        resolveOnce();
      });

      // Write the base64 image (strip data URL prefix if present)
      const base64 = (payload.data || '').toString();
      const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      try {
        child.stdin.write(cleanBase64 + '\n');
        child.stdin.end();
      } catch (err) {
        console.error('Failed writing to SmartSpectra stdin:', err?.message || err);
        socket.emit('biometric_update', { status: 'ERROR', error: 'stdin_write_failed' });
        resolveOnce();
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`✅ Presage Relay listening on *:${PORT}`);
  console.log(`   CORS origin: ${ALLOWED_ORIGIN}`);
  console.log(`   SmartSpectra: ${SMART_SPECTRA_PATH} ${SMART_SPECTRA_ARGS.join(' ')}`);
});


