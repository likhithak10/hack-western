import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Activation wave component for ripple effects
function ActivationWave({ position, radius, color, activation, visible }) {
  const waveRef = useRef();
  
  useFrame((state) => {
    if (!waveRef.current || !visible) return;
    
    const time = state.clock.elapsedTime;
    const scale = 1 + Math.sin(time * 2) * 0.3;
    const opacity = activation * (0.3 + Math.sin(time * 3) * 0.2);
    
    waveRef.current.scale.setScalar(scale);
    if (waveRef.current.material) {
      waveRef.current.material.opacity = opacity;
    }
  });
  
  if (!visible) return null;
  
  return (
    <mesh ref={waveRef} position={position}>
      <ringGeometry args={[radius * 0.8, radius * 1.2, 32]} />
      <meshBasicMaterial
        color={color}
        transparent={true}
        opacity={activation * 0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const LOBE_COLORS = {
  frontal: new THREE.Color(1, 0.84, 0), // Gold/Yellow
  parietal: new THREE.Color(0, 0.8, 1), // Cyan
  occipital: new THREE.Color(0, 0.5, 1), // Blue
  temporal: new THREE.Color(1, 0.5, 0), // Orange
  cerebellum: new THREE.Color(0.7, 0, 1), // Purple
  limbic: new THREE.Color(1, 0.3, 0) // Red/Orange
};

function BrainVisualization({ activations, signals }) {
  const brainGroupRef = useRef();
  const particlesRefs = useRef({});
  const waveRefs = useRef({});
  
  // Create brain lobe geometries - more realistic brain shape
  const lobes = useMemo(() => {
    // Use ellipsoids and modified spheres for more brain-like shapes
    const lobeGeometries = {
      frontal: new THREE.SphereGeometry(0.9, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2),
      parietal: new THREE.SphereGeometry(0.85, 32, 32),
      occipital: new THREE.SphereGeometry(0.7, 32, 32, 0, Math.PI * 2, Math.PI / 3, Math.PI / 2),
      temporal: new THREE.SphereGeometry(0.6, 32, 32),
      cerebellum: new THREE.SphereGeometry(0.5, 32, 32),
      limbic: new THREE.SphereGeometry(0.35, 32, 32)
    };

    // Position lobes to form a more realistic brain shape
    const lobePositions = {
      frontal: [0, 0.7, 0.2],
      parietal: [0, 0.1, 0],
      occipital: [0, -0.5, -0.1],
      temporal: [-0.6, 0, 0],
      cerebellum: [0, -0.4, -0.6],
      limbic: [0, 0.3, 0.4]
    };

    return Object.keys(lobeGeometries).map(lobeName => ({
      name: lobeName,
      geometry: lobeGeometries[lobeName],
      position: lobePositions[lobeName],
      color: LOBE_COLORS[lobeName],
      radius: lobeGeometries[lobeName].parameters.radius
    }));
  }, []);

  // Create particle systems for each lobe
  useEffect(() => {
    lobes.forEach(lobe => {
      const particleCount = 500;
      const particles = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Random position within lobe sphere
        const radius = lobe.radius * (0.2 + Math.random() * 0.8);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        positions[i3] = lobe.position[0] + radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = lobe.position[1] + radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = lobe.position[2] + radius * Math.cos(phi);
        
        // Random velocity
        velocities[i3] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
        
        // Color based on lobe
        colors[i3] = lobe.color.r;
        colors[i3 + 1] = lobe.color.g;
        colors[i3 + 2] = lobe.color.b;
      }

      particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      particles.userData.velocities = velocities;
      particles.userData.basePosition = lobe.position;
      particles.userData.lobeName = lobe.name;

      particlesRefs.current[lobe.name] = particles;
    });
  }, [lobes]);

  // Animate particles and update materials
  useFrame((state, delta) => {
    if (!brainGroupRef.current) return;

    const time = state.clock.elapsedTime;
    const heartbeatBPM = signals?.heartbeat?.bpm || 70;
    const hrTime = (heartbeatBPM / 60) * time;

    // Global brain pulse synchronized to heartbeat
    const pulseScale = 1 + 0.02 * Math.sin(hrTime * 2 * Math.PI);
    brainGroupRef.current.scale.setScalar(pulseScale);

    // Stress shake effect
    if (signals?.heartbeat?.bpm > 110 || activations?.limbic > 0.7) {
      const shake = 0.005;
      brainGroupRef.current.position.x = (Math.random() - 0.5) * shake;
      brainGroupRef.current.position.y = (Math.random() - 0.5) * shake;
      brainGroupRef.current.position.z = (Math.random() - 0.5) * shake;
    } else {
      brainGroupRef.current.position.set(0, 0, 0);
    }

    // Update each lobe
    lobes.forEach(lobe => {
      const activation = activations[lobe.name] || 0;
      const lobeMesh = brainGroupRef.current.children.find(
        child => child.userData.lobeName === lobe.name
      );

      if (lobeMesh) {
        // Update emissive intensity
        const maxIntensity = 2;
        lobeMesh.material.emissiveIntensity = activation * maxIntensity;
        lobeMesh.material.emissive = lobe.color.clone().multiplyScalar(activation);
        
        // Update glow based on activation
        if (lobeMesh.material.emissiveIntensity > 0.1) {
          lobeMesh.material.emissiveIntensity = activation * maxIntensity;
        }
      }

      // Update particle system
      const particles = particlesRefs.current[lobe.name];
      if (particles) {
        const positions = particles.attributes.position;
        const velocities = particles.userData.velocities;
        const basePos = particles.userData.basePosition;
        
        // Calculate particle speed based on activation and cognitive arousal
        const avgActivation = Object.values(activations).reduce((a, b) => a + b, 0) / 
                             Object.values(activations).length;
        const bpmFactor = heartbeatBPM / 70;
        const speedMultiplier = Math.max(0.5, Math.min(3, avgActivation * bpmFactor * activation));

        for (let i = 0; i < positions.count; i++) {
          const i3 = i * 3;
          
          // Update position
          positions.array[i3] += velocities[i3] * speedMultiplier;
          positions.array[i3 + 1] += velocities[i3 + 1] * speedMultiplier;
          positions.array[i3 + 2] += velocities[i3 + 2] * speedMultiplier;
          
          // Boundary check - keep particles within lobe sphere
          const dx = positions.array[i3] - basePos[0];
          const dy = positions.array[i3 + 1] - basePos[1];
          const dz = positions.array[i3 + 2] - basePos[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const maxDist = lobe.radius * 1.2;
          
          if (dist > maxDist) {
            // Reset to random position within lobe
            const radius = lobe.radius * (0.2 + Math.random() * 0.8);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions.array[i3] = basePos[0] + radius * Math.sin(phi) * Math.cos(theta);
            positions.array[i3 + 1] = basePos[1] + radius * Math.sin(phi) * Math.sin(theta);
            positions.array[i3 + 2] = basePos[2] + radius * Math.cos(phi);
          }
        }
        
        positions.needsUpdate = true;
      }
    });
  });

  return (
    <group ref={brainGroupRef}>
      {/* Render brain lobes */}
      {lobes.map(lobe => (
        <group key={lobe.name}>
          <mesh
            geometry={lobe.geometry}
            position={lobe.position}
            userData={{ lobeName: lobe.name }}
          >
            <meshStandardMaterial
              color={lobe.color}
              emissive={lobe.color}
              emissiveIntensity={0}
              metalness={0.2}
              roughness={0.8}
              transparent={true}
              opacity={0.9}
            />
          </mesh>
          
          {/* Particle system for neurons */}
          {particlesRefs.current[lobe.name] && (
            <points
              geometry={particlesRefs.current[lobe.name]}
              userData={{ lobeName: lobe.name }}
            >
              <pointsMaterial
                size={0.08}
                vertexColors={true}
                transparent={true}
                opacity={0.9}
                sizeAttenuation={true}
                blending={THREE.AdditiveBlending}
              />
            </points>
          )}
          
          {/* Activation wave/ripple effect */}
          <ActivationWave 
            position={lobe.position}
            radius={lobe.radius}
            color={lobe.color}
            activation={activations[lobe.name]}
            visible={activations[lobe.name] > 0.3}
          />
        </group>
      ))}
    </group>
  );
}

export default BrainVisualization;

