"""
Flask Backend API for Presage Heart Rate Detection
Receives video frames from React frontend and returns real-time heart rate from Presage API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import cv2
from presage_heartbeat import PresageHeartbeatDetector
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

presage_detector = None

def init_presage():
    global presage_detector
    try:
        presage_detector = PresageHeartbeatDetector()
        if presage_detector.start_measurement(mode="continuous"):
            print("✓ Presage heartbeat detector initialized")
            return True
        return False
    except Exception as e:
        print(f"✗ Error initializing Presage: {e}")
        return False

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'presage_connected': presage_detector is not None and presage_detector.is_measuring
    })

@app.route('/api/heartrate/start', methods=['POST'])
def start_measurement():
    global presage_detector
    try:
        if presage_detector is None:
            if not init_presage():
                return jsonify({'error': 'Failed to initialize Presage'}), 500
        if presage_detector.is_measuring:
            return jsonify({'status': 'already_measuring'})
        return jsonify({'status': 'started'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/heartrate/frame', methods=['POST'])
def process_frame():
    global presage_detector
    try:
        if presage_detector is None:
            if not init_presage():
                return jsonify({'heartRate': 0, 'status': 'error', 'message': 'Presage not initialized'}), 500
        
        data = request.json
        if not data or 'frame' not in data:
            return jsonify({'heartRate': 0, 'status': 'error', 'message': 'No frame data'}), 400
        
        image_data = data['frame']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'heartRate': 0, 'status': 'error', 'message': 'Failed to decode image'}), 400
        
        timestamp_ms = data.get('timestamp', None)
        if timestamp_ms is None:
            import time
            timestamp_ms = int(time.time() * 1000)
        
        presage_detector.process_frame_continuous(frame)
        heart_rate = presage_detector.get_pulse()
        
        if heart_rate > 0:
            status = 'success'
            message = f'Heart rate: {heart_rate} BPM'
        else:
            status = 'calculating'
            message = 'Calculating...'
        
        return jsonify({
            'heartRate': heart_rate,
            'status': status,
            'message': message,
            'timestamp': timestamp_ms
        })
    except Exception as e:
        return jsonify({'heartRate': 0, 'status': 'error', 'message': str(e)}), 500

@app.route('/api/heartrate/current', methods=['GET'])
def get_current_heartrate():
    global presage_detector
    if presage_detector is None or not presage_detector.is_measuring:
        return jsonify({'heartRate': 0, 'status': 'error', 'message': 'Not measuring'}), 400
    heart_rate = presage_detector.get_pulse()
    return jsonify({
        'heartRate': heart_rate,
        'status': 'success' if heart_rate > 0 else 'calculating',
        'message': f'Current: {heart_rate} BPM' if heart_rate > 0 else 'Calculating...'
    })

@app.route('/api/heartrate/export', methods=['GET'])
def export_heartrate_data():
    global presage_detector
    if presage_detector is None:
        return jsonify({'error': 'No data'}), 400
    history = []
    if hasattr(presage_detector, 'metrics_buffer'):
        history = list(presage_detector.metrics_buffer)
    return jsonify({
        'currentHeartRate': presage_detector.get_pulse(),
        'history': history,
        'isMeasuring': presage_detector.is_measuring
    })

@app.route('/api/heartrate/stop', methods=['POST'])
def stop_measurement():
    global presage_detector
    try:
        if presage_detector and presage_detector.is_measuring:
            presage_detector.stop_measurement()
            return jsonify({'status': 'stopped'})
        return jsonify({'status': 'not_measuring'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Presage Heart Rate Detection API...")
    print("=" * 60)
    init_presage()
    print("API: http://localhost:5000")
    print("=" * 60)
    app.run(debug=True, port=5000, host='0.0.0.0')
