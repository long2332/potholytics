from flask import Flask, request, jsonify
from flask_cors import CORS
import supervision as sv
import numpy as np
from ultralytics import YOLO
import cv2
import os
from werkzeug.utils import secure_filename
import base64
import requests  # Add this import statement
import easyocr
import re
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path='../my-app/.env')
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load the YOLO model
model = YOLO("yolo11_117_epochs_best.pt")

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.getenv('GOOGLE_MAPS_API_KEY'):
    raise ValueError("GOOGLE_MAPS_API_KEY environment variable is not set")

def resize_image(image):
    # Calculate new dimensions (25% of original)
    width = int(image.shape[1] * 0.25)
    height = int(image.shape[0] * 0.25)
    
    # Resize image
    return cv2.resize(image, (width, height), interpolation=cv2.INTER_AREA)

def get_address_from_coordinates(lat, lon):
    api_key = os.getenv('GOOGLE_MAPS_API_KEY')
    url = f'https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={api_key}'
    
    response = requests.get(url)
    result = response.json()
    
    if response.status_code == 200 and result['status'] == 'OK':
        return result['results'][0]['formatted_address']
    return "Address not found"

def extract_image_info(image):
    # Initialize reader once (you can move this to global scope)
    reader = easyocr.Reader(['en'])
    # Get bottom portion of image
    height = image.shape[0]

    bottom_crop = image[height-100:height, :]

    # Extract text using EasyOCR
    results = reader.readtext(bottom_crop)
    text = ' '.join([result[1] for result in results])
    print("Extracted text:", text)  # Debug print
    
    # Separate patterns for date and time
    date_pattern = re.compile(r'(\d{2}-\d{2}-\d{4})')
    time_pattern = re.compile(r'(\d{2}:\d{2}:\d{2})')
    date_match = date_pattern.search(text)
    time_match = time_pattern.search(text)

    # Updated pattern to match the specific format with km/h
    longitude_pattern = re.compile(r'km/h\s*E\s*(\d+\s*\.\s*\d+)')
    latitude_pattern = re.compile(r',\s*N\s*(\d+\s*\.\s*\d+)')  # Updated to capture potential spaces
    
    latitude_match = latitude_pattern.search(text)
    longitude_match = longitude_pattern.search(text)

    # Clean and convert latitude
    latitude = None
    if latitude_match:
        lat_str = latitude_match.group(1)
        # First remove all spaces
        lat_str = lat_str.replace(" ", "")
        # Then keep only digits and decimal point
        lat_str = ''.join(char for char in lat_str if char.isdigit() or char == '.')
        try:
            latitude = float(lat_str)
        except ValueError:
            latitude = None

    # Clean and convert longitude
    longitude = None
    if longitude_match:
        long_str = longitude_match.group(1)
        # First remove all spaces
        long_str = long_str.replace(" ", "")
        # Then keep only digits and decimal point
        long_str = ''.join(char for char in long_str if char.isdigit() or char == '.')
        try:
            longitude = float(long_str)
        except ValueError:
            longitude = None

    result = {
        'date': date_match.group(1) if date_match else None,
        'time': time_match.group(1) if time_match else None,
        'latitude': latitude,
        'longitude': longitude,
        'address': get_address_from_coordinates(latitude, longitude) if latitude and longitude else None
    }
    return result

@app.route('/detect-potholes', methods=['POST'])
def detect_potholes():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        # Save the file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Check if file is MP4
        is_video = filename.lower().endswith('.mp4')
        detections = []

        if is_video:
            # Process video
            cap = cv2.VideoCapture(filepath)
            frame_count = 0
            annotated_frames = []  # Store annotated frames
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_count % 30 == 0:  # Process every 30th frame (1 fps)
                    # Run inference
                    results = model(frame)
                    
                    # Process results
                    if len(results) > 0:
                        result = results[0]
                        detection_data = sv.Detections.from_ultralytics(result)
                        
                        # Only process frames with detections
                        if len(detection_data) > 0:
                            info = extract_image_info(frame)
                            # Create annotators
                            box_annotator = sv.BoxAnnotator(thickness=4)
                            label_annotator = sv.LabelAnnotator(text_thickness=2, text_scale=1)
                            
                            # Prepare labels
                            labels = []
                            for detection in detection_data:
                                confidence = float(detection[2])
                                class_id = int(detection[3])
                                labels.append(f"{model.names[int(class_id)]} {confidence:0.2f}")
                            
                            # Annotate the frame
                            frame = box_annotator.annotate(scene=frame, detections=detection_data)
                            frame = label_annotator.annotate(scene=frame, detections=detection_data, labels=labels)
                            
                            # Resize the frame
                            frame = resize_image(frame)
                            
                            # Convert frame to base64 for sending to frontend
                            _, buffer = cv2.imencode('.jpg', frame)
                            frame_base64 = base64.b64encode(buffer).decode('utf-8')
                            
                            annotated_frames.append({
                                "info": info,
                                "image": frame_base64,
                                "detections_count": len(detection_data)
                            })

                frame_count += 1
            
            cap.release()
            
            return jsonify({
                "frames": annotated_frames,
                "total_frames": len(annotated_frames)
            })

        else:
            # Process image
            frame = cv2.imread(filepath)

            results = model(frame)
            
            if len(results) > 0:
                result = results[0]
                detection_data = sv.Detections.from_ultralytics(result)
                
                # Only process if there are detections
                if len(detection_data) > 0:
                    info = extract_image_info(frame)
                    # Create annotators
                    box_annotator = sv.BoxAnnotator(thickness=4)
                    label_annotator = sv.LabelAnnotator(text_thickness=2, text_scale=1)
                    # Prepare labels
                    labels = []
                    for detection in detection_data:
                        confidence = float(detection[2])
                        class_id = int(detection[3])
                        labels.append(f"{model.names[int(class_id)]} {confidence:0.2f}")
                    
                    # Annotate the frame
                    frame = box_annotator.annotate(scene=frame, detections=detection_data)
                    frame = label_annotator.annotate(scene=frame, detections=detection_data, labels=labels)

                    # Resize the frame
                    frame = resize_image(frame)
                    # Convert frame to base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    return jsonify({
                        "info": info,
                        "image": frame_base64,
                        "detections_count": len(detection_data)
                    })
            
            return jsonify({
                "image": None,
                "detections_count": 0
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Clean up temporary file
        if os.path.exists(filepath):
            os.remove(filepath)

if __name__ == '__main__':
    app.run(debug=True, port=5000) 