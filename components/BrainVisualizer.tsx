import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { BiometricData, DistractionType } from '../types';

interface BrainSignal {
  focus?: number;        // 0–1
  talking?: number;      // 0–1
  distraction?: number; // 0–1
  eyeDir?: 'left' | 'right' | 'up' | 'down' | 'center';
  blink?: boolean;
}

interface BrainVisualizerProps {
  biometrics: BiometricData;
  className?: string;
}

interface ActivationNotification {
  lobe: string;
  reason: string;
  timestamp: number;
}

// Convert BiometricData to BrainSignal
function convertBiometricsToSignal(biometrics: BiometricData): BrainSignal {
  const focus = Math.max(0, Math.min(1, biometrics.gazeStability / 100));
  
  // Map distraction types to talking/distraction levels
  let talking = 0;
  let distraction = 0;
  let eyeDir: 'left' | 'right' | 'up' | 'down' | 'center' = 'center';
  
  // Debug logging
  if (biometrics.distractionType === 'TALKING') {
    console.log('🧠 BrainVisualizer: TALKING detected', {
      distractionType: biometrics.distractionType,
      gazeStability: biometrics.gazeStability,
      focus: focus
    });
  }
  
  switch (biometrics.distractionType) {
    case 'TALKING':
      // Make talking level proportional to how much focus is reduced
      // When talking, gazeStability drops to ~30 (from presageService)
      // Calculate talking intensity: lower gazeStability = more intense talking
      // Base talking level from focus reduction (100% focus -> 30% when talking = 70% talking)
      const baseTalking = (100 - biometrics.gazeStability) / 100; // 0-1 scale
      // Normalize: if gazeStability is 30, that's 70% talking intensity
      // Scale it so 30 gazeStability = ~0.7 talking, but allow it to vary
      talking = Math.max(0.3, Math.min(1.0, baseTalking * 1.2)); // 30% min, can go up to 100%
      // Distraction is proportional to talking (more talking = more distraction from focus)
      distraction = talking * 0.4; // Talking causes some distraction but not as much as phone
      console.log('🧠 BrainVisualizer: Talking calculated', { talking, distraction, baseTalking });
      break;
    case 'PHONE':
      distraction = 0.8;
      eyeDir = 'down';
      break;
    case 'EYES_CLOSED':
      distraction = 0.6;
      break;
    case 'EATING':
      distraction = 0.5;
      eyeDir = 'down';
      break;
    case 'NO_FACE':
      distraction = 0.9;
      break;
    case 'NONE':
      distraction = 0;
      // Derive eye direction from gaze stability variations
      if (focus > 0.7) eyeDir = 'center';
      else if (focus > 0.5) eyeDir = 'up';
      else eyeDir = 'down';
      break;
  }
  
  return { focus, talking, distraction, eyeDir, blink: false };
}

// Create a more realistic brain shape using torus knot
function createBrainGeometry() {
  // Use a torus knot to create a brain-like convoluted shape
  const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 100, 16);
  
  // Modify vertices to create a more brain-like shape
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    
    // Create more organic, brain-like folds
    const noise = Math.sin(x * 3) * Math.cos(y * 2) * Math.sin(z * 2.5) * 0.1;
    positions.setXYZ(i, x + noise, y + noise * 0.5, z + noise);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return geometry;
}

// Brain Lobe Component with realistic positioning
function BrainLobe({ 
  position, 
  scale, 
  color, 
  activation, 
  name,
  geometry
}: { 
  position: [number, number, number];
  scale: number;
  color: string;
  activation: number;
  name: string;
  geometry: THREE.BufferGeometry;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame((state) => {
    if (meshRef.current && materialRef.current) {
      // Breathing animation
      const breath = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
      meshRef.current.scale.setScalar(scale * breath);
      
      // Emissive glow based on activation
      const glowIntensity = activation * 3;
      materialRef.current.emissive.set(color);
      materialRef.current.emissiveIntensity = glowIntensity;
      materialRef.current.opacity = 0.4 + activation * 0.6;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={color}
        emissiveIntensity={0}
        transparent
        opacity={0.4}
        roughness={0.2}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Neuron Particle System with dense network
function NeuronField({ signal }: { signal: BrainSignal }) {
  const particlesRef = useRef<THREE.Points>(null);
  const connectionsRef = useRef<THREE.LineSegments>(null);
  
  const { particles, connections } = useMemo(() => {
    const count = 500; // More particles for denser network
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const connectionPoints: number[] = [];
    
    // Generate random neuron positions within brain volume
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Create positions in a brain-like volume
      const radius = 1.5 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Initial purple/blue colors
      colors[i3] = 0.3 + Math.random() * 0.4;     // R
      colors[i3 + 1] = 0.4 + Math.random() * 0.3; // G
      colors[i3 + 2] = 0.7 + Math.random() * 0.3;  // B
    }
    
    // Create connections between nearby neurons
    let connectionCount = 0;
    const maxConnections = 800; // More connections for dense network
    for (let i = 0; i < count && connectionCount < maxConnections; i++) {
      for (let j = i + 1; j < count && connectionCount < maxConnections; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < 1.2) {
          connectionPoints.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          );
          connectionCount++;
        }
      }
    }
    
    return {
      particles: { positions, colors },
      connections: new Float32Array(connectionPoints)
    };
  }, []);
  
  useFrame((state) => {
    if (!particlesRef.current) return;
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
    
    const focus = signal.focus || 0;
    const distraction = signal.distraction || 0;
    const talking = signal.talking || 0;
    
    // Update particle positions and colors based on signals
    for (let i = 0; i < positions.length; i += 3) {
      // Focus effect: cluster neurons proportionally
      const pullStrength = focus * 0.02; // Proportional to focus level
      const centerX = 0;
      const centerY = 0;
      const centerZ = 0;
      positions[i] += (centerX - positions[i]) * pullStrength;
      positions[i + 1] += (centerY - positions[i + 1]) * pullStrength;
      positions[i + 2] += (centerZ - positions[i + 2]) * pullStrength;
      
      // Low focus: disperse proportionally
      if (focus < 0.5) {
        const disperse = (0.5 - focus) * 0.02; // More dispersion when focus is lower
        positions[i] += (Math.random() - 0.5) * disperse;
        positions[i + 1] += (Math.random() - 0.5) * disperse;
        positions[i + 2] += (Math.random() - 0.5) * disperse;
      }
      
      // Distraction effect: scatter neurons proportionally
      const scatter = distraction * 0.02; // Proportional to distraction level
      positions[i] += (Math.random() - 0.5) * scatter;
      positions[i + 1] += (Math.random() - 0.5) * scatter;
      positions[i + 2] += (Math.random() - 0.5) * scatter;
      
      // Color based on proportional state mixing
      // Base: blue/purple (low activity)
      let r = 0.3;
      let g = 0.4;
      let b = 0.7;
      
      // High focus: blend toward white/yellow proportionally
      if (focus > 0.5) {
        const focusFactor = (focus - 0.5) * 2; // 0-1 range for focus > 0.5
        r = r + (1.0 - r) * focusFactor;
        g = g + (0.95 - g) * focusFactor;
        b = b + (0.8 - b) * focusFactor;
      } else if (focus > 0.2) {
        // Medium focus: blend toward teal/green proportionally
        const focusFactor = (focus - 0.2) / 0.3; // 0-1 range for focus 0.2-0.5
        r = r + (0.1 - r) * focusFactor;
        g = g + (0.9 - g) * focusFactor;
        b = b + (0.8 - b) * focusFactor;
      }
      
      // Distraction: shift to orange/red proportionally
      if (distraction > 0.1) {
        const distFactor = distraction;
        r = Math.min(1, r + distFactor * 0.6);
        g = Math.max(0, g - distFactor * 0.4);
        b = Math.max(0, b - distFactor * 0.5);
      }
      
      // Talking: temporal lobe activation (orange/yellow) proportionally
      if (talking > 0.1) {
        const talkFactor = talking;
        r = Math.min(1, r + talkFactor * 0.4);
        g = Math.min(1, g + talkFactor * 0.6);
      }
      
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
  });
  
  return (
    <>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.positions.length / 3}
            array={particles.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={particles.colors.length / 3}
            array={particles.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.9} sizeAttenuation blending={THREE.AdditiveBlending} />
      </points>
      {connections.length > 0 && (
        <lineSegments ref={connectionsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={connections.length / 3}
              array={connections}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#4a90e2" transparent opacity={0.3} />
        </lineSegments>
      )}
    </>
  );
}

// Main Brain Component
function Brain({ signal, onActivationChange }: { signal: BrainSignal; onActivationChange: (notifications: ActivationNotification[]) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const blinkFlashRef = useRef(0);
  const brainGeometry = useMemo(() => createBrainGeometry(), []);
  
  // Calculate lobe activations dynamically based on proportional signal changes
  const lobeActivations = useMemo(() => {
    const focus = signal.focus || 0;
    const talking = signal.talking || 0;
    const distraction = signal.distraction || 0;
    const eyeDir = signal.eyeDir || 'center';
    
    // Frontal lobe: focus, attention, planning
    // Base activation from focus, reduced when talking (resource allocation)
    let frontal = focus * (1 - talking * 0.4); // Talking reduces frontal focus proportionally
    let frontalReason = '';
    
    // Eye direction adds proportional boost
    if (eyeDir === 'up') {
      frontal = Math.min(1, frontal + focus * 0.3);
      if (frontal > 0.2) frontalReason = `Looking up (${Math.round(focus * 100)}% focus)`;
    }
    
    // Talking activates frontal for speech planning, but reduces sustained focus
    if (talking > 0.1) {
      const speechPlanning = talking * 0.3;
      frontal = Math.min(1, frontal + speechPlanning);
      if (!frontalReason && talking > 0.2) {
        frontalReason = `Talking detected (${Math.round(talking * 100)}%) - Speech planning`;
      }
    }
    
    // High focus state
    if (focus > 0.5 && talking < 0.2) {
      if (!frontalReason) frontalReason = `High focus (${Math.round(focus * 100)}%)`;
    }
    
    // Parietal lobe: sensory integration
    // Proportional to focus, enhanced by eye movement
    let parietal = focus * 0.6;
    let parietalReason = '';
    
    if (eyeDir === 'left' || eyeDir === 'right') {
      const eyeBoost = 0.3 * focus; // Proportional to current focus level
      parietal = Math.min(1, parietal + eyeBoost);
      parietalReason = `Looking ${eyeDir} (${Math.round(focus * 100)}% focus)`;
    } else if (focus > 0.4) {
      parietalReason = `Sensory integration (${Math.round(focus * 100)}% focus)`;
    }
    
    // Temporal lobe: language, talking
    // Directly proportional to talking level, with eye direction boost
    let temporal = talking;
    let temporalReason = '';
    
    if (talking > 0.1) {
      temporalReason = `Talking detected (${Math.round(talking * 100)}%)`;
    }
    
    // Eye direction adds proportional boost
    if (eyeDir === 'left') {
      const eyeBoost = focus * 0.2;
      temporal = Math.min(1, temporal + eyeBoost);
      if (!temporalReason && focus > 0.3) {
        temporalReason = `Looking left (${Math.round(focus * 100)}% focus)`;
      }
    }
    
    // Occipital lobe: visual processing
    // Proportional to focus, enhanced by rightward gaze
    let occipital = focus * 0.4;
    let occipitalReason = '';
    
    if (eyeDir === 'right') {
      const eyeBoost = focus * 0.4;
      occipital = Math.min(1, occipital + eyeBoost);
      occipitalReason = `Looking right (${Math.round(focus * 100)}% focus)`;
    } else if (focus > 0.5) {
      occipitalReason = `Visual processing (${Math.round(focus * 100)}% focus)`;
    }
    
    // Limbic: stress, distraction, emotion
    // Directly proportional to distraction level
    let limbic = distraction;
    let limbicReason = '';
    
    if (distraction > 0.1) {
      limbicReason = `Distraction (${Math.round(distraction * 100)}%)`;
    }
    
    // Eye direction adds proportional boost
    if (eyeDir === 'down') {
      const eyeBoost = (1 - focus) * 0.3; // More when focus is low
      limbic = Math.min(1, limbic + eyeBoost);
      if (!limbicReason) {
        limbicReason = `Looking down (${Math.round((1 - focus) * 100)}% low focus)`;
      }
    }
    
    // Cerebellum: motor control
    // Inverse of distraction, proportional to calm state
    let cerebellum = (1 - distraction) * 0.4;
    let cerebellumReason = '';
    
    if (distraction < 0.3 && focus > 0.3) {
      cerebellumReason = `Calm state (${Math.round((1 - distraction) * 100)}% calm)`;
    }
    
    return { 
      frontal: { value: Math.max(0, Math.min(1, frontal)), reason: frontalReason },
      parietal: { value: Math.max(0, Math.min(1, parietal)), reason: parietalReason },
      temporal: { value: Math.max(0, Math.min(1, temporal)), reason: temporalReason },
      occipital: { value: Math.max(0, Math.min(1, occipital)), reason: occipitalReason },
      limbic: { value: Math.max(0, Math.min(1, limbic)), reason: limbicReason },
      cerebellum: { value: Math.max(0, Math.min(1, cerebellum)), reason: cerebellumReason }
    };
  }, [signal]);
  
  // Track previous activations to detect changes
  const prevActivationsRef = useRef<typeof lobeActivations | null>(null);
  
  // Generate activation notifications - only show the MOST ACTIVE lobe
  useEffect(() => {
    // Dynamic threshold based on signal intensity
    const getDynamicThreshold = (baseValue: number) => {
      return Math.max(0.2, 0.35 - baseValue * 0.15);
    };
    
    // Collect all active lobes with their activation values
    const activeLobes: Array<{ name: string; value: number; reason: string }> = [];
    
    const checkLobe = (
      name: string,
      activation: { value: number; reason: string },
      prevValue: number | null
    ) => {
      const threshold = getDynamicThreshold(activation.value);
      const hasReason = activation.reason && activation.reason.length > 0;
      const isActivated = activation.value > threshold;
      
      // Show notification if activation is above threshold AND has a reason
      if (isActivated && hasReason) {
        // Only add if there's a significant change (new activation or increased)
        const significantChange = prevValue === null || 
          activation.value > (prevValue * 1.15) || 
          Math.abs(activation.value - prevValue) > 0.15;
        
        if (significantChange) {
          activeLobes.push({
            name,
            value: activation.value,
            reason: activation.reason
          });
        }
      }
    };
    
    const prev = prevActivationsRef.current;
    
    checkLobe('Frontal Lobe', lobeActivations.frontal, prev?.frontal.value ?? null);
    checkLobe('Temporal Lobe', lobeActivations.temporal, prev?.temporal.value ?? null);
    checkLobe('Parietal Lobe', lobeActivations.parietal, prev?.parietal.value ?? null);
    checkLobe('Occipital Lobe', lobeActivations.occipital, prev?.occipital.value ?? null);
    checkLobe('Limbic System', lobeActivations.limbic, prev?.limbic.value ?? null);
    checkLobe('Cerebellum', lobeActivations.cerebellum, prev?.cerebellum.value ?? null);
    
    // Update previous activations
    prevActivationsRef.current = { ...lobeActivations };
    
    // Only show the MOST ACTIVE lobe (highest activation value)
    if (activeLobes.length > 0) {
      // Sort by activation value (highest first)
      activeLobes.sort((a, b) => b.value - a.value);
      const mostActive = activeLobes[0];
      
      onActivationChange([{
        lobe: mostActive.name,
        reason: mostActive.reason,
        timestamp: Date.now()
      }]);
    } else {
      // No active lobes - clear notifications
      onActivationChange([]);
    }
  }, [lobeActivations, onActivationChange]);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    
    // Blink flash effect
    if (signal.blink) {
      blinkFlashRef.current = 1.0;
    }
    if (blinkFlashRef.current > 0) {
      blinkFlashRef.current -= 0.05;
    }
    
    // Global pulse (breathing)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
    groupRef.current.scale.setScalar(pulse);
    
    // Distraction shake
    const distraction = signal.distraction || 0;
    if (distraction > 0.6) {
      const shake = (Math.random() - 0.5) * distraction * 0.02;
      groupRef.current.rotation.x += shake;
      groupRef.current.rotation.y += shake;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Main Brain Structure */}
      <mesh geometry={brainGeometry} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#2a2a3a"
          emissive="#1a1a2a"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      {/* Brain Lobes with realistic positioning */}
      <BrainLobe 
        position={[0, 0.8, 0.3]} 
        scale={0.6} 
        color="#ffd700" 
        activation={lobeActivations.frontal.value}
        name="frontal"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[-0.7, 0.2, 0.4]} 
        scale={0.5} 
        color="#00d9ff" 
        activation={lobeActivations.parietal.value}
        name="parietal-left"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[0.7, 0.2, 0.4]} 
        scale={0.5} 
        color="#00d9ff" 
        activation={lobeActivations.parietal.value}
        name="parietal-right"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[-0.5, -0.3, 0.2]} 
        scale={0.45} 
        color="#ff8c00" 
        activation={lobeActivations.temporal.value}
        name="temporal-left"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[0.5, -0.3, 0.2]} 
        scale={0.45} 
        color="#ff8c00" 
        activation={lobeActivations.temporal.value}
        name="temporal-right"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[0, -0.9, -0.2]} 
        scale={0.35} 
        color="#9370db" 
        activation={lobeActivations.cerebellum.value}
        name="cerebellum"
        geometry={brainGeometry}
      />
      <BrainLobe 
        position={[0, 0.1, -0.3]} 
        scale={0.3} 
        color="#ff0055" 
        activation={lobeActivations.limbic.value}
        name="limbic"
        geometry={brainGeometry}
      />
      
      {/* Neuron Field */}
      <NeuronField signal={signal} />
      
      {/* Blink flash overlay */}
      {blinkFlashRef.current > 0 && (
        <mesh>
          <sphereGeometry args={[3, 32, 32]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={blinkFlashRef.current * 0.3}
          />
        </mesh>
      )}
    </group>
  );
}

// Activation Notifications Component - Only shows ONE lobe at a time
function ActivationNotifications({ notifications }: { notifications: ActivationNotification[] }) {
  const [currentNotification, setCurrentNotification] = useState<ActivationNotification | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Show the most recent notification (only one at a time)
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      
      // Only update if it's a different lobe or significantly newer
      if (!currentNotification || 
          currentNotification.lobe !== latest.lobe || 
          latest.timestamp - currentNotification.timestamp > 500) {
        setCurrentNotification(latest);
        
        // Auto-hide after 4 seconds of no new updates
        timeoutRef.current = setTimeout(() => {
          setCurrentNotification(null);
        }, 4000);
      }
    } else {
      // No notifications - hide after a short delay
      timeoutRef.current = setTimeout(() => {
        setCurrentNotification(null);
      }, 500);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [notifications, currentNotification]);
  
  if (!currentNotification) return null;
  
  return (
    <div className="absolute top-4 left-4 z-20">
      <div
        key={`${currentNotification.lobe}-${currentNotification.timestamp}`}
        className="bg-dark-800/95 backdrop-blur-sm border-2 border-neon-purple rounded-lg px-5 py-3 text-sm font-mono text-white shadow-2xl animate-fade-in"
        style={{
          animation: 'fadeIn 0.3s ease-in',
        }}
      >
        <div className="text-neon-purple font-bold text-base mb-1">{currentNotification.lobe}</div>
        <div className="text-gray-300 text-xs">{currentNotification.reason} → Active</div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in;
        }
      `}</style>
    </div>
  );
}

export default function BrainVisualizer({ biometrics, className }: BrainVisualizerProps) {
  const signal = useMemo(() => convertBiometricsToSignal(biometrics), [biometrics]);
  const [notifications, setNotifications] = useState<ActivationNotification[]>([]);
  
  return (
    <div className={`w-full h-full relative ${className || ''}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'radial-gradient(circle, #0a0a0f 0%, #050505 100%)' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.6} />
        <pointLight position={[-10, -10, -10]} intensity={0.4} color="#4a90e2" />
        
        <Brain signal={signal} onActivationChange={setNotifications} />
        
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          autoRotate={true}
          autoRotateSpeed={0.5}
          minDistance={3}
          maxDistance={10}
        />
      </Canvas>
      
      <ActivationNotifications notifications={notifications} />
    </div>
  );
}
