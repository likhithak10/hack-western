const EventEmitter = require('events');

// Webcam capture will be handled client-side
// This class is kept for API compatibility but processing happens on client
class WebcamCapture extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
  }

  async start() {
    // Client will handle webcam capture
    // Backend just needs to be ready to receive signals
    this.isRunning = true;
    console.log('Webcam capture ready (handled by client)');
  }

  async stop() {
    this.isRunning = false;
  }
}

module.exports = WebcamCapture;

