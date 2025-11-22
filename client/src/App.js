import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import BrainVisualization from './components/BrainVisualization';
import WebcamProcessor from './components/WebcamProcessor';
import UI from './components/UI';
import './App.css';

function App() {
  const [activations, setActivations] = useState({
    frontal: 0.3,
    parietal: 0.3,
    occipital: 0.3,
    temporal: 0.3,
    cerebellum: 0.3,
    limbic: 0.3
  });
  
  const [signals, setSignals] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="App">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        <BrainVisualization 
          activations={activations}
          signals={signals}
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
          autoRotate={false}
        />
      </Canvas>
      
      <WebcamProcessor
        onActivationsChange={setActivations}
        onSignalsChange={setSignals}
        onConnectionChange={setIsConnected}
      />
      
      <UI 
        activations={activations}
        signals={signals}
        isConnected={isConnected}
      />
    </div>
  );
}

export default App;

