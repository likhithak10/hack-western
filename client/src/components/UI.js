import React from 'react';
import './UI.css';

function UI({ activations, signals, isConnected }) {
  const formatActivation = (value) => {
    return Math.round(value * 100);
  };

  const getActivationColor = (value) => {
    if (value > 0.7) return '#ff4444';
    if (value > 0.5) return '#ffaa00';
    if (value > 0.3) return '#ffff00';
    return '#888888';
  };

  return (
    <div className="ui-overlay">
      <div className="ui-panel">
        <div className="ui-header">
          <h1>NeuroLens 3D</h1>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>

        <div className="ui-section">
          <h2>Brain Region Activations</h2>
          <div className="activation-grid">
            {Object.entries(activations || {}).map(([region, value]) => (
              <div key={region} className="activation-item">
                <div className="activation-label">
                  {region.charAt(0).toUpperCase() + region.slice(1)} Lobe
                </div>
                <div className="activation-bar-container">
                  <div
                    className="activation-bar"
                    style={{
                      width: `${formatActivation(value)}%`,
                      backgroundColor: getActivationColor(value)
                    }}
                  />
                  <span className="activation-value">{formatActivation(value)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {signals && (
          <div className="ui-section">
            <h2>Live Signals</h2>
            <div className="signals-grid">
              {signals.gaze && (
                <div className="signal-item">
                  <span className="signal-label">Gaze:</span>
                  <span className="signal-value">
                    {signals.gaze.lookingUp && '↑ Up'}
                    {signals.gaze.lookingDown && '↓ Down'}
                    {signals.gaze.lookingLeft && '← Left'}
                    {signals.gaze.lookingRight && '→ Right'}
                    {!signals.gaze.lookingUp && !signals.gaze.lookingDown && 
                     !signals.gaze.lookingLeft && !signals.gaze.lookingRight && 'Center'}
                  </span>
                </div>
              )}
              
              {signals.attention && (
                <div className="signal-item">
                  <span className="signal-label">Attention:</span>
                  <span className="signal-value">
                    {formatActivation(signals.attention.score)}%
                    {signals.attention.focused && ' (Focused)'}
                    {signals.attention.distracted && ' (Distracted)'}
                  </span>
                </div>
              )}
              
              {signals.heartbeat && (
                <div className="signal-item heartbeat-display">
                  <span className="signal-label">Heart Rate:</span>
                  <span className="signal-value heartbeat-value">{signals.heartbeat.bpm} BPM</span>
                  {signals.heartbeat.movementBoost > 5 && (
                    <span className="movement-indicator">↑ {signals.heartbeat.movementBoost}</span>
                  )}
                </div>
              )}
              
              {signals.blink && (
                <div className="signal-item">
                  <span className="signal-label">Blinks:</span>
                  <span className="signal-value">
                    {signals.blink.count} ({signals.blink.rate}/min)
                    {signals.blink.isBlinking && ' 👁️'}
                  </span>
                </div>
              )}
              
              {signals.pose?.movement && (
                <div className="signal-item">
                  <span className="signal-label">Movement:</span>
                  <span className="signal-value">
                    {Math.round(signals.pose.movement.intensity * 100)}%
                    {signals.pose.movement.isMoving && ' 🏃'}
                  </span>
                </div>
              )}
              
              {signals.pose && (
                <div className="signal-item">
                  <span className="signal-label">Posture:</span>
                  <span className="signal-value">
                    {signals.pose.upright ? 'Upright' : 'Slouching'}
                  </span>
                </div>
              )}
              
              {signals.facial && (
                <div className="signal-item">
                  <span className="signal-label">Expression:</span>
                  <span className="signal-value">
                    {signals.facial.raisedEyebrows && 'Raised Eyebrows '}
                    {signals.facial.smiling && 'Smiling '}
                    {signals.facial.frowning && 'Frowning '}
                    {signals.facial.neutral && 'Neutral'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ui-footer">
          <p>Allow webcam access to begin visualization</p>
          <p className="ui-hint">Move your eyes, change expressions, adjust posture</p>
        </div>
      </div>
    </div>
  );
}

export default UI;

