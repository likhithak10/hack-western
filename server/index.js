const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Import processing modules
const SignalProcessor = require('./signalProcessor');

// Initialize components
const processor = new SignalProcessor();

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);
  
  // Handle incoming signals from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'signals') {
        // Process signals from client into brain activations
        const activations = processor.processSignals(data.signals);
        
        // Send back brain activation data
        ws.send(JSON.stringify({
          type: 'brain-activation',
          activations,
          signals: data.signals,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast brain activation data to all clients (for multi-client scenarios)
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    clients: clients.size,
    processor: 'ready'
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket server ready for connections');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  clients.forEach(client => client.close());
  process.exit(0);
});

