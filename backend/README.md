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
# Select one of the integration modes below:
#  - cli:     spawn per-frame CLI that reads base64 from stdin and outputs JSON
#  - pipeline:spawn a long-running SmartSpectra app (e.g., hello_vitals) and parse its stdout
SMART_SPECTRA_MODE=cli

# CLI mode (if you have a CLI that reads frames from stdin and prints JSON)
# SMART_SPECTRA_PATH=./path/to/smart_spectra_cli
# SMART_SPECTRA_ARGS=--analyze

# Pipeline mode (if you built hello_vitals from the SDK)
# SMART_SPECTRA_MODE=pipeline
# SMART_SPECTRA_PATH=./path/to/hello_vitals
# SMART_SPECTRA_ARGS=              # optional; if empty and SMARTSPECTRA_API_KEY is set, the key is passed as argv[1]
# SMARTSPECTRA_API_KEY=YOUR_KEY    # optional; hello_vitals also accepts env var SMARTSPECTRA_API_KEY

# Timeout per frame (ms) — used in CLI mode
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

## Windows + WSL (SmartSpectra SDK on Ubuntu 22.04)

If you’re on Windows and need the actual SmartSpectra SDK:

1) Install WSL with Ubuntu 22.04:

```powershell
wsl --install -d Ubuntu-22.04
```

2) Inside Ubuntu, install the SDK (summarized):

```bash
sudo apt update
sudo apt install -y build-essential git lsb-release libcurl4-openssl-dev libssl-dev pkg-config libv4l-dev libgles2-mesa-dev libunwind-dev gpg curl
curl -L -o cmake-3.27.0-linux-x86_64.sh https://github.com/Kitware/CMake/releases/download/v3.27.0/cmake-3.27.0-linux-x86_64.sh
chmod +x cmake-3.27.0-linux-x86_64.sh
sudo ./cmake-3.27.0-linux-x86_64.sh --skip-license --prefix=/usr/local

curl -s "https://presage-security.github.io/PPA/KEY.gpg" | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/presage-technologies.gpg >/dev/null
sudo curl -s --compressed -o /etc/apt/sources.list.d/presage-technologies.list "https://presage-security.github.io/PPA/presage-technologies.list"
sudo apt update
sudo apt install -y libsmartspectra-dev
```

3) Build the included Hello Vitals example in this repo (from Ubuntu):

```bash
cd /mnt/c/Users/likhi/hack-western/backend
mkdir -p build && cd build
cmake .. && make
# Binary at: /mnt/c/Users/likhi/hack-western/backend/build/hello_vitals
```

4) Backend configuration on Windows for pipeline mode (example `.env` in `backend/`):

```
PORT=3001
ALLOWED_ORIGIN=http://localhost:3000
SMART_SPECTRA_MODE=pipeline
SMART_SPECTRA_PATH=wsl
# Ensure the path exists in WSL; adjust if your username or path differs
SMART_SPECTRA_ARGS=/mnt/c/Users/likhi/hack-western/backend/build/hello_vitals
SMARTSPECTRA_API_KEY=YOUR_KEY
```

This starts the Linux `hello_vitals` via WSL and the relay will parse its stdout for heart rate. The frontend will receive `biometric_update` events with at least `heartRate` populated. (Distraction classification is not provided by `hello_vitals` and will default to neutral.)

## Protocol

- Frontend emits: `stream_frame` with payload `{ timestamp: number, data: string }` where `data` is a base64-encoded JPEG (data URL prefix allowed).
- CLI mode: Backend spawns the SmartSpectra CLI, writes the base64 to STDIN, and expects a single JSON object on STDOUT, e.g.:

```json
{ "status": "PHONE", "heartRate": 95, "gazeStability": 40 }
```

- Pipeline mode: Backend runs a long-lived SmartSpectra process (e.g., `hello_vitals`) and parses its stdout lines (e.g., “Vitals - Pulse: …”) to emit periodic `biometric_update` messages.

- Backend emits: `biometric_update` with the parsed data, or `{ "status": "ERROR", "error": "<reason>" }` on failure.

## Notes

- The relay uses a drop-oldest queue so only the most recent frame is processed when frames arrive faster than the CLI can handle.
- For high throughput, consider a persistent SmartSpectra process with a streaming protocol instead of spawning per frame.


