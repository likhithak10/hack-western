// Signal Processing Engine
// Maps various signals to brain region activations

class SignalProcessor {
  constructor() {
    this.activationHistory = {
      frontal: [],
      parietal: [],
      occipital: [],
      temporal: [],
      cerebellum: [],
      limbic: []
    };
    
    this.smoothingWindow = 10; // frames to average
  }

  processSignals(signals) {
    const activations = {
      frontal: this.calculateFrontalActivation(signals),
      parietal: this.calculateParietalActivation(signals),
      occipital: this.calculateOccipitalActivation(signals),
      temporal: this.calculateTemporalActivation(signals),
      cerebellum: this.calculateCerebellumActivation(signals),
      limbic: this.calculateLimbicActivation(signals)
    };

    // Apply smoothing
    Object.keys(activations).forEach(region => {
      this.activationHistory[region].push(activations[region]);
      if (this.activationHistory[region].length > this.smoothingWindow) {
        this.activationHistory[region].shift();
      }
      
      // Use moving average for smoother visualization
      const avg = this.activationHistory[region].reduce((a, b) => a + b, 0) / 
                  this.activationHistory[region].length;
      activations[region] = avg;
    });

    return activations;
  }

  calculateFrontalActivation(signals) {
    let activation = 0.3; // Base level

    // Gaze up → planning/attention
    if (signals.gaze?.lookingUp) {
      activation += 0.4;
    }

    // Raised eyebrows → surprise/attention
    if (signals.facial?.raisedEyebrows) {
      activation += 0.3;
    }

    // High attention score
    if (signals.attention?.score > 0.6) {
      activation += 0.2;
    }

    // Upright posture → engagement
    if (signals.pose?.upright) {
      activation += 0.1;
    }

    return Math.min(1, activation);
  }

  calculateParietalActivation(signals) {
    let activation = 0.3;

    // Upright posture → sensory integration
    if (signals.pose?.upright) {
      activation += 0.4;
    }

    // High attention + moderate BPM → focused
    if (signals.attention?.score > 0.5 && 
        signals.heartbeat?.bpm > 60 && 
        signals.heartbeat?.bpm < 90) {
      activation += 0.3;
    }

    // Slouching → decreased activation
    if (signals.pose?.slouching) {
      activation -= 0.2;
    }

    return Math.max(0, Math.min(1, activation));
  }

  calculateOccipitalActivation(signals) {
    let activation = 0.3;

    // Gaze right → visual processing
    if (signals.gaze?.lookingRight) {
      activation += 0.3;
    }

    // High blink rate → fatigue
    if (signals.blink?.highRate) {
      activation -= 0.3;
    }

    // Looking down → introspection (decreased visual)
    if (signals.gaze?.lookingDown) {
      activation -= 0.2;
    }

    // Low BPM → calm/meditative
    if (signals.heartbeat?.bpm < 60) {
      activation += 0.1;
    }

    return Math.max(0, Math.min(1, activation));
  }

  calculateTemporalActivation(signals) {
    let activation = 0.3;

    // Gaze left → language/memory recall
    if (signals.gaze?.lookingLeft) {
      activation += 0.4;
    }

    // Smiling → positive emotion (temporal involvement)
    if (signals.facial?.smiling) {
      activation += 0.2;
    }

    return Math.min(1, activation);
  }

  calculateCerebellumActivation(signals) {
    let activation = 0.2; // Lower base for motor control

    // Slouching → motor activity decrease
    if (signals.pose?.slouching) {
      activation += 0.2; // Still some activity, but different pattern
    }

    // Low attention + low BPM → relaxed motor state
    if (signals.attention?.score < 0.4 && signals.heartbeat?.bpm < 60) {
      activation += 0.1;
    }

    return Math.min(1, activation);
  }

  calculateLimbicActivation(signals) {
    let activation = 0.2;

    // High BPM → stress/arousal
    if (signals.heartbeat?.bpm > 110) {
      activation += 0.5;
    }

    // Pupil dilation → excitement/stress
    if (signals.pupil?.dilation === 'large') {
      activation += 0.3;
    }

    // Frowning → stress/frustration
    if (signals.facial?.frowning) {
      activation += 0.4;
    }

    // High attention + high BPM → alert stress
    if (signals.attention?.score > 0.7 && signals.heartbeat?.bpm > 100) {
      activation += 0.2;
    }

    // Low BPM → calm (decreased limbic)
    if (signals.heartbeat?.bpm < 60) {
      activation -= 0.1;
    }

    return Math.max(0, Math.min(1, activation));
  }

  // Calculate color based on activation and region
  getColorForRegion(region, activation) {
    const colorMap = {
      frontal: { r: 1, g: 0.84, b: 0 }, // Gold/Yellow
      parietal: { r: 0, g: 0.8, b: 1 }, // Cyan
      occipital: { r: 0, g: 0.5, b: 1 }, // Blue
      temporal: { r: 1, g: 0.5, b: 0 }, // Orange
      cerebellum: { r: 0.7, g: 0, b: 1 }, // Purple
      limbic: { r: 1, g: 0.3, b: 0 } // Red/Orange
    };

    const baseColor = colorMap[region] || { r: 1, g: 1, b: 1 };
    
    // Adjust intensity based on activation
    return {
      r: baseColor.r * activation,
      g: baseColor.g * activation,
      b: baseColor.b * activation,
      intensity: activation
    };
  }

  // Calculate particle speed based on cognitive arousal
  getParticleSpeed(activations, heartbeat) {
    // Higher activation + higher BPM = faster particles
    const avgActivation = Object.values(activations).reduce((a, b) => a + b, 0) / 
                         Object.values(activations).length;
    const bpmFactor = (heartbeat?.bpm || 70) / 70; // Normalize to 70 BPM
    
    return Math.max(0.5, Math.min(3, avgActivation * bpmFactor));
  }
}

module.exports = SignalProcessor;

