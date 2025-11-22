# Presage Relay Server

Bridges the React app to your C++ SmartSpectra engine over WebSocket.

## Quick Start

1. Install dependencies:

```bash
cd backend
npm install
```

2. Configure environment (create a `.env` file in `backend/`):

```bash
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000
# Absolute or relative path to your SmartSpectra executable
SMART_SPECTRA_PATH=./path/to/smart_spectra_cli
# Optional CLI args
SMART_SPECTRA_ARGS=--analyze
# Timeout per frame (ms)
CLI_TIMEOUT_MS=3000
```

3. Run:

```bash
npm run start
# or during development (auto-restart)
npm run dev
```

4. Health check:

```bash
curl http://localhost:3001/health
```

## Protocol

- Frontend emits: `stream_frame` with payload `{ timestamp: number, data: string }` where `data` is a base64-encoded JPEG (data URL prefix allowed).
- Backend spawns the SmartSpectra CLI, writes the base64 to STDIN, and expects a single JSON object on STDOUT, e.g.:

```json
{ "status": "PHONE", "heartRate": 95, "gazeStability": 40 }
```

- Backend emits: `biometric_update` with the parsed JSON, or `{ "status": "ERROR", "error": "<reason>" }` on failure.

## Notes

- The relay uses a drop-oldest queue so only the most recent frame is processed when frames arrive faster than the CLI can handle.
- For high throughput, consider a persistent SmartSpectra process with a streaming protocol instead of spawning per frame.


