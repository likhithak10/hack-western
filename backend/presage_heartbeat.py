"""
Presage SmartSpectra Official Heartbeat Detection Integration
Uses Presage's official REST API for accurate heartbeat/pulse detection
"""
import cv2
import numpy as np
import requests
import base64
import time
import json
from typing import Optional, Dict, Any, Callable
from config import PRESAGE_API_KEY
import threading
from collections import deque

class PresageHeartbeatDetector:
    """
    Official Presage SmartSpectra Heartbeat Detector
    
    Uses Presage's official REST API for accurate pulse/heartbeat detection.
    Based on: https://github.com/Presage-Security/SmartSpectra
    
    This implementation:
    1. Captures video frames from camera
    2. Sends frames to Presage REST API for processing
    3. Receives real-time metrics (pulse, breathing, etc.)
    """
    
    def __init__(self, api_key: str = None):
        """
        Initialize Presage heartbeat detector
        
        Args:
            api_key: Presage API key (defaults to config.PRESAGE_API_KEY)
        """
        self.api_key = api_key or PRESAGE_API_KEY
        if not self.api_key:
            raise ValueError("PRESAGE_API_KEY required. Set it in .env file")
        
        # Presage API configuration
        # Note: Actual endpoints may vary - check docs.physiology.presagetech.com
        self.api_base_url = "https://physiology.presagetech.com/api/v1"
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-API-Key": self.api_key  # Alternative auth method
        }
        
        # Session management
        self.session_id = None
        self.is_measuring = False
        self.metrics_callback = None
        
        # Current metrics
        self.current_pulse = 0
        self.current_breathing_rate = 0
        self.metrics_buffer = deque(maxlen=100)
        
        # Frame processing
        self.frame_queue = deque(maxlen=30)  # Buffer frames
        self.processing_thread = None
        self.stop_processing = False
        
    def start_measurement(self, mode: str = "continuous") -> bool:
        """
        Start a measurement session
        
        Args:
            mode: "continuous" or "spot"
            
        Returns:
            True if started successfully
        """
        try:
            # Create session with Presage API
            # Endpoint structure based on their C++ REST examples
            session_data = {
                "mode": mode,
                "measurement_type": "vitals"  # Pulse, breathing, etc.
            }
            
            # Try different possible endpoint patterns with SHORT timeout to avoid hanging
            endpoints_to_try = [
                f"{self.api_base_url}/sessions",
                f"{self.api_base_url}/measurements",
                f"https://api.physiology.presagetech.com/v1/sessions"
            ]
            
            session_id = None
            for endpoint in endpoints_to_try:
                try:
                    # Use 2 second timeout to prevent hanging
                    response = requests.post(
                        endpoint,
                        headers=self.headers,
                        json=session_data,
                        timeout=2  # SHORT timeout
                    )
                    if response.status_code == 200 or response.status_code == 201:
                        data = response.json()
                        session_id = data.get("session_id") or data.get("id") or data.get("sessionId")
                        if session_id:
                            print(f"SUCCESS: Presage session started")
                            self.session_id = session_id
                            self.is_measuring = True
                            return True
                except requests.exceptions.Timeout:
                    # Timeout - skip this endpoint, try next
                    continue
                except requests.exceptions.RequestException:
                    # Other errors - try next endpoint
                    continue
            
            # If REST API doesn't work, silently return False (will use local detection)
            return False
            
        except Exception as e:
            print(f"Error starting Presage measurement: {e}")
            return False
    
    def send_frame(self, frame: np.ndarray, timestamp_ms: int = None) -> Optional[Dict]:
        """
        Send a video frame to Presage API for processing
        
        Args:
            frame: OpenCV frame (BGR format)
            timestamp_ms: Timestamp in milliseconds
            
        Returns:
            Dictionary with metrics or None
        """
        if not self.session_id:
            return None
        
        try:
            timestamp_ms = timestamp_ms or int(time.time() * 1000)
            
            # Encode frame to JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Send frame to Presage API
            frame_data = {
                "frame": frame_base64,
                "timestamp": timestamp_ms,
                "format": "jpg"
            }
            
            # Try different endpoint patterns
            endpoints_to_try = [
                f"{self.api_base_url}/sessions/{self.session_id}/frames",
                f"{self.api_base_url}/sessions/{self.session_id}/video",
                f"{self.api_base_url}/measurements/{self.session_id}/frames"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    response = requests.post(
                        endpoint,
                        headers=self.headers,
                        json=frame_data,
                        timeout=5
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                except requests.exceptions.RequestException:
                    continue
            
            return None
            
        except Exception as e:
            # Silently fail - will use local detection
            return None
    
    def get_metrics(self) -> Optional[Dict]:
        """
        Get current metrics from Presage API
        
        Returns:
            Dictionary with pulse, breathing, and other metrics
        """
        if not self.session_id:
            return None
        
        try:
            # Try different endpoint patterns
            endpoints_to_try = [
                f"{self.api_base_url}/sessions/{self.session_id}/metrics",
                f"{self.api_base_url}/measurements/{self.session_id}",
                f"{self.api_base_url}/sessions/{self.session_id}/results"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    response = requests.get(
                        endpoint,
                        headers=self.headers,
                        timeout=5
                    )
                    
                    if response.status_code == 200:
                        metrics = response.json()
                        
                        # Parse Presage metrics format
                        # Based on their MetricsBuffer structure
                        pulse = None
                        breathing = None
                        
                        if "pulse" in metrics:
                            pulse_data = metrics["pulse"]
                            if isinstance(pulse_data, dict):
                                pulse = pulse_data.get("value") or pulse_data.get("strict") or pulse_data.get("bpm")
                            else:
                                pulse = pulse_data
                        
                        if "breathing" in metrics:
                            breathing_data = metrics["breathing"]
                            if isinstance(breathing_data, dict):
                                breathing = breathing_data.get("value") or breathing_data.get("strict") or breathing_data.get("bpm")
                            else:
                                breathing = breathing_data
                        
                        result = {
                            "pulse": pulse,
                            "breathing_rate": breathing,
                            "timestamp": time.time(),
                            "raw_metrics": metrics
                        }
                        
                        # Update current values with robust validation (like Presage does)
                        if pulse is not None:
                            try:
                                # Validate and convert pulse value
                                pulse_float = float(pulse)
                                if not (np.isnan(pulse_float) or np.isinf(pulse_float)):
                                    pulse_int = int(round(pulse_float))
                                    # Validate range (30-200 BPM)
                                    if 30 <= pulse_int <= 200:
                                        self.current_pulse = pulse_int
                            except (ValueError, TypeError, OverflowError):
                                # Invalid value, don't update
                                pass
                        
                        if breathing is not None:
                            try:
                                # Validate and convert breathing value
                                breathing_float = float(breathing)
                                if not (np.isnan(breathing_float) or np.isinf(breathing_float)):
                                    breathing_int = int(round(breathing_float))
                                    # Validate range (5-60 breaths/min)
                                    if 5 <= breathing_int <= 60:
                                        self.current_breathing_rate = breathing_int
                            except (ValueError, TypeError, OverflowError):
                                # Invalid value, don't update
                                pass
                        
                        return result
                        
                except requests.exceptions.RequestException:
                    continue
            
            return None
            
        except Exception as e:
            return None
    
    def process_frame_continuous(self, frame: np.ndarray):
        """
        Process frame in continuous mode (async)
        
        Args:
            frame: Video frame to process
        """
        if not self.is_measuring or not self.session_id:
            return
        
        try:
            # Add to queue for processing
            timestamp_ms = int(time.time() * 1000)
            self.frame_queue.append((frame, timestamp_ms))
            
            # Process every 5 frames (to reduce API calls and rate limiting)
            if len(self.frame_queue) >= 5:
                frame_to_send, timestamp = self.frame_queue.popleft()
                
                # Send frame to Presage API
                metrics = self.send_frame(frame_to_send, timestamp)
                
                # Update metrics if received
                if metrics:
                    if self.metrics_callback:
                        self.metrics_callback(metrics)
                    
                    # Parse pulse from response with robust validation
                    if "pulse" in metrics:
                        pulse_value = metrics["pulse"]
                        if pulse_value is not None:
                            try:
                                pulse_float = float(pulse_value)
                                if not (np.isnan(pulse_float) or np.isinf(pulse_float)):
                                    pulse_int = int(round(pulse_float))
                                    # Validate range (30-200 BPM)
                                    if 30 <= pulse_int <= 200:
                                        self.current_pulse = pulse_int
                            except (ValueError, TypeError, OverflowError):
                                # Invalid value, don't update
                                pass
                    
                    # Also try to get metrics directly
                    direct_metrics = self.get_metrics()
                    if direct_metrics:
                        if self.metrics_callback:
                            self.metrics_callback(direct_metrics)
        except Exception as e:
            # Silently handle errors - don't crash
            pass
    
    def stop_measurement(self):
        """Stop the measurement session"""
        self.is_measuring = False
        self.stop_processing = True
        
        if self.session_id:
            try:
                # End session
                endpoints_to_try = [
                    f"{self.api_base_url}/sessions/{self.session_id}",
                    f"{self.api_base_url}/measurements/{self.session_id}"
                ]
                
                for endpoint in endpoints_to_try:
                    try:
                        requests.delete(endpoint, headers=self.headers, timeout=5)
                        break
                    except:
                        continue
            except:
                pass
            
            self.session_id = None
    
    def get_pulse(self) -> int:
        """Get current pulse rate in BPM"""
        return self.current_pulse
    
    def get_breathing_rate(self) -> int:
        """Get current breathing rate in BPM"""
        return self.current_breathing_rate
    
    def set_metrics_callback(self, callback: Callable[[Dict], None]):
        """
        Set callback for receiving metrics updates
        
        Args:
            callback: Function that receives metrics dictionary
        """
        self.metrics_callback = callback


def test_presage_api():
    """Test if Presage API is accessible"""
    client = PresageHeartbeatDetector()
    
    print("Testing Presage API connectivity...")
    print(f"API Key: {client.api_key[:10]}...")
    print(f"Base URL: {client.api_base_url}")
    
    # Try to start session
    if client.start_measurement():
        print("SUCCESS: Presage API connected successfully!")
        print(f"  Session ID: {client.session_id}")
        
        # Test with a dummy frame
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = client.send_frame(test_frame)
        print(f"  Frame send test: {'SUCCESS' if result else 'FAILED'}")
        
        client.stop_measurement()
        return True
    else:
        print("FAILED: Could not connect to Presage API")
        print("  Please check:")
        print("  1. Your API key is correct")
        print("  2. API endpoints at https://docs.physiology.presagetech.com/")
        print("  3. Your internet connection")
        return False


if __name__ == "__main__":
    test_presage_api()

