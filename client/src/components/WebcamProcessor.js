import { useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Pose } from '@mediapipe/pose';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';

function WebcamProcessor({ onActivationsChange, onSignalsChange, onConnectionChange }) {
  const wsRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const poseRef = useRef(null);
  const heartbeatHistoryRef = useRef([]);
  const processingRef = useRef(false);
  const blinkHistoryRef = useRef([]);
  const eyeOpenHistoryRef = useRef([]);
  const previousPoseRef = useRef(null);
  const movementHistoryRef = useRef([]);

  useEffect(() => {
    // Initialize MediaPipe
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMeshRef.current = faceMesh;
    poseRef.current = pose;

    // Setup MediaPipe callbacks
    faceMesh.onResults(handleFaceResults);
    pose.onResults(handlePoseResults);

    // Initialize WebSocket
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      onConnectionChange(true);
      startWebcam();
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      onConnectionChange(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onConnectionChange(false);
    };

    return () => {
      ws.close();
      stopWebcam();
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      videoRef.current = video;

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvasRef.current = canvas;

      video.addEventListener('loadedmetadata', () => {
        processFrame();
      });
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    processingRef.current = false;
  };

  const processFrame = () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Process with MediaPipe
      if (faceMeshRef.current) {
        faceMeshRef.current.send({ image: canvas });
      }
      if (poseRef.current) {
        poseRef.current.send({ image: canvas });
      }
    }

    requestAnimationFrame(processFrame);
  };

  const handleFaceResults = (results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

    const landmarks = results.multiFaceLandmarks[0];
    const signals = extractSignalsFromFace(landmarks, canvasRef.current);
    
    // Combine with heartbeat data (movement is already tracked in handlePoseResults)
    if (heartbeatHistoryRef.current.length > 0) {
      signals.heartbeat = detectHeartbeat(heartbeatHistoryRef.current);
    }

    // Send to backend via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'signals',
        signals: {
          ...signals,
          timestamp: Date.now()
        }
      }));
    }

    onSignalsChange(signals);
  };

  const handlePoseResults = (results) => {
    if (!results.poseLandmarks) return;

    const poseData = extractPoseData(results.poseLandmarks);
    
    // Calculate movement from previous pose
    const movement = calculateMovement(results.poseLandmarks);
    poseData.movement = movement;
    
    // Track movement for heart rate adjustment
    const now = Date.now();
    movementHistoryRef.current.push({
      intensity: movement.intensity,
      timestamp: now
    });
    
    // Keep only last 5 seconds
    const fiveSecondsAgo = now - 5000;
    movementHistoryRef.current = movementHistoryRef.current.filter(
      m => m.timestamp > fiveSecondsAgo
    );
    
    // Store current pose for next frame
    previousPoseRef.current = results.poseLandmarks;
    
    // Update signals with pose data
    onSignalsChange(prev => ({
      ...prev,
      pose: poseData
    }));
  };
  
  const calculateMovement = (currentLandmarks) => {
    if (!previousPoseRef.current) {
      return { intensity: 0, velocity: 0 };
    }
    
    // Calculate movement based on key points (shoulders, hips, nose)
    const keyPoints = [0, 11, 12, 23, 24]; // nose, shoulders, hips
    let totalMovement = 0;
    
    keyPoints.forEach(index => {
      if (currentLandmarks[index] && previousPoseRef.current[index]) {
        const dx = currentLandmarks[index].x - previousPoseRef.current[index].x;
        const dy = currentLandmarks[index].y - previousPoseRef.current[index].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        totalMovement += distance;
      }
    });
    
    const avgMovement = totalMovement / keyPoints.length;
    const intensity = Math.min(1, avgMovement * 100); // Scale to 0-1
    
    return {
      intensity,
      velocity: avgMovement,
      isMoving: intensity > 0.1
    };
  };

  const extractSignalsFromFace = (landmarks, canvas) => {
    // Extract facial features
    // Landmark indices from MediaPipe Face Mesh
    const leftEyeTop = landmarks[159];
    const leftEyeBottom = landmarks[145];
    const rightEyeTop = landmarks[386];
    const rightEyeBottom = landmarks[374];
    const leftEyebrow = landmarks[107];
    const rightEyebrow = landmarks[336];
    const noseTip = landmarks[4];
    const mouthLeft = landmarks[61];
    const mouthRight = landmarks[291];
    const mouthTop = landmarks[13];
    const mouthBottom = landmarks[14];

    // Calculate eye openness
    const leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
    const rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);
    const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;

    // Track eye openness history for blink detection
    const now = Date.now();
    eyeOpenHistoryRef.current.push({
      value: avgEyeOpen,
      timestamp: now
    });
    
    // Keep only last 3 seconds
    const threeSecondsAgo = now - 3000;
    eyeOpenHistoryRef.current = eyeOpenHistoryRef.current.filter(
      h => h.timestamp > threeSecondsAgo
    );

    // Detect blinks - eye closes then opens
    const blinkThreshold = 0.008; // Threshold for closed eye
    const openThreshold = 0.015; // Threshold for open eye
    const isBlinking = avgEyeOpen < blinkThreshold;
    
    // Detect blink event (transition from open to closed to open)
    if (eyeOpenHistoryRef.current.length >= 3) {
      const recent = eyeOpenHistoryRef.current.slice(-3);
      const wasOpen = recent[0].value > openThreshold;
      const isClosed = recent[1].value < blinkThreshold;
      const isOpenAgain = recent[2].value > openThreshold;
      
      if (wasOpen && isClosed && isOpenAgain) {
        // Blink detected!
        blinkHistoryRef.current.push(now);
        
        // Keep only blinks from last minute
        const oneMinuteAgo = now - 60000;
        blinkHistoryRef.current = blinkHistoryRef.current.filter(
          t => t > oneMinuteAgo
        );
      }
    }
    
    // Calculate blink rate (blinks per minute)
    let normalizedBlinkRate = 0;
    if (blinkHistoryRef.current.length > 0) {
      const timeWindow = now - blinkHistoryRef.current[0];
      if (timeWindow > 0) {
        // Calculate blinks per minute based on actual time window
        const blinksPerMs = blinkHistoryRef.current.length / timeWindow;
        normalizedBlinkRate = Math.round(blinksPerMs * 60000); // Convert to per minute
      } else {
        // If all blinks happened very recently, estimate from count
        normalizedBlinkRate = blinkHistoryRef.current.length * 20; // Rough estimate
      }
    }
    
    // Ensure reasonable blink rate (normal is 15-20 blinks/min, max 30)
    normalizedBlinkRate = Math.min(30, Math.max(0, normalizedBlinkRate));

    // Calculate eyebrow position (raised = lower y value)
    const eyebrowY = (leftEyebrow.y + rightEyebrow.y) / 2;
    const raisedEyebrows = eyebrowY < 0.3;

    // Calculate mouth shape (smile/frown)
    const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
    const mouthHeight = Math.abs(mouthTop.y - mouthBottom.y);
    const mouthRatio = mouthWidth / mouthHeight;
    const smiling = mouthRatio > 1.5 && mouthTop.y < mouthBottom.y;
    const frowning = mouthRatio < 1.2 && mouthTop.y > mouthBottom.y;

    // Estimate gaze direction (simplified - would use actual eye landmarks)
    const eyeCenterX = ((landmarks[33].x + landmarks[263].x) / 2) - 0.5;
    const eyeCenterY = ((landmarks[33].y + landmarks[263].y) / 2) - 0.5;
    
    const lookingUp = eyeCenterY < -0.1;
    const lookingDown = eyeCenterY > 0.1;
    const lookingLeft = eyeCenterX < -0.1;
    const lookingRight = eyeCenterX > 0.1;

    // Estimate pupil size (simplified)
    const pupilSize = avgEyeOpen;
    const pupilDilation = pupilSize > 0.02 ? 'large' : 
                         pupilSize < 0.01 ? 'constricted' : 'normal';

    // Calculate attention score (based on eye stability and openness)
    const attentionScore = Math.min(1, Math.max(0, 
      0.5 + (avgEyeOpen * 10) - Math.abs(eyeCenterX) - Math.abs(eyeCenterY)
    ));

    // Store for heartbeat detection
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const avgRed = calculateFaceRegionRed(imageData, landmarks);
      heartbeatHistoryRef.current.push({
        value: avgRed,
        timestamp: Date.now()
      });
      
      // Keep only last 2 seconds
      const twoSecondsAgo = Date.now() - 2000;
      heartbeatHistoryRef.current = heartbeatHistoryRef.current.filter(
        h => h.timestamp > twoSecondsAgo
      );
    }

    return {
      gaze: {
        x: eyeCenterX,
        y: eyeCenterY,
        lookingUp,
        lookingDown,
        lookingLeft,
        lookingRight,
        confidence: 0.7
      },
      pupil: {
        size: pupilSize,
        dilation: pupilDilation,
        confidence: 0.6
      },
      blink: {
        rate: normalizedBlinkRate,
        count: blinkHistoryRef.current.length,
        highRate: normalizedBlinkRate > 20,
        isBlinking,
        lastBlink: blinkHistoryRef.current.length > 0 
          ? blinkHistoryRef.current[blinkHistoryRef.current.length - 1]
          : null,
        confidence: 0.8
      },
      attention: {
        score: attentionScore,
        focused: attentionScore > 0.6,
        distracted: attentionScore < 0.4,
        confidence: 0.7
      },
      facial: {
        raisedEyebrows,
        smiling,
        frowning,
        neutral: !raisedEyebrows && !smiling && !frowning,
        confidence: 0.7
      }
    };
  };

  const extractPoseData = (landmarks) => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const nose = landmarks[0];

    const shoulderAvgY = (leftShoulder.y + rightShoulder.y) / 2;
    const verticalDiff = nose.y - shoulderAvgY;
    
    const slouching = verticalDiff < 0.15;
    const upright = !slouching;

    return {
      slouching,
      upright,
      confidence: 0.8
    };
  };

  const calculateFaceRegionRed = (imageData, landmarks) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Use nose region for PPG
    const noseX = Math.floor(landmarks[4].x * width);
    const noseY = Math.floor(landmarks[4].y * height);
    const regionSize = 50;
    
    let redSum = 0;
    let pixelCount = 0;
    
    for (let y = noseY - regionSize; y < noseY + regionSize; y++) {
      for (let x = noseX - regionSize; x < noseX + regionSize; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          redSum += data[idx];
          pixelCount++;
        }
      }
    }
    
    return pixelCount > 0 ? redSum / pixelCount : 0;
  };

  const detectHeartbeat = (history) => {
    if (history.length < 30) {
      return { bpm: 70, raw: 0, baseBpm: 70 };
    }

    const values = history.map(h => h.value);
    const peaks = detectPeaks(values);
    
    // Base BPM from PPG signal
    let baseBpm = 70;
    if (peaks.length > 1) {
      const avgInterval = (peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1);
      const fps = 30;
      baseBpm = Math.round((60 * fps) / avgInterval);
      baseBpm = Math.max(40, Math.min(150, baseBpm));
    }
    
    // Adjust BPM based on movement
    let adjustedBpm = baseBpm;
    if (movementHistoryRef.current.length > 0) {
      const avgMovement = movementHistoryRef.current.reduce((sum, m) => sum + m.intensity, 0) / 
                         movementHistoryRef.current.length;
      
      // Movement increases heart rate
      // High movement (0.5-1.0) can add 20-40 BPM
      const movementBoost = Math.round(avgMovement * 40);
      adjustedBpm = baseBpm + movementBoost;
      
      // Clamp to reasonable range
      adjustedBpm = Math.max(50, Math.min(180, adjustedBpm));
    }

    return {
      bpm: adjustedBpm,
      baseBpm,
      raw: values[values.length - 1] || 0,
      movementBoost: adjustedBpm - baseBpm
    };
  };

  const detectPeaks = (values) => {
    const peaks = [];
    const threshold = (Math.max(...values) + Math.min(...values)) / 2;
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1] && values[i] > threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  };

  // Listen for brain activation updates from WebSocket
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'brain-activation') {
          onActivationsChange(data.activations);
          onSignalsChange(data.signals);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [onActivationsChange, onSignalsChange]);

  return null;
}

export default WebcamProcessor;

