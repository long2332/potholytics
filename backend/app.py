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
from google.cloud import vision
load_dotenv(dotenv_path='../my-app/.env')

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "melodic-argon-392105-53b6a5fcfdfe.json"
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
# model = YOLO("yolo11_117_epochs_best.pt")

# Load the YOLO model
model = YOLO("SEA_yolo11_200epochs.pt")
model = YOLO("yolo8_100epochs.pt")

client = vision.ImageAnnotatorClient()
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

def detect_text(frame):
    """
    Extract text from a single video frame using Google Cloud Vision API.
    """
    # Convert frame (NumPy array) to bytes
    _, encoded_image = cv2.imencode('.jpg', frame)
    content = encoded_image.tobytes()

    # Prepare image for Google Vision API
    image = vision.Image(content=content)
    response = client.text_detection(image=image)

    if response.error.message:
        raise Exception(response.error.message)

    # Extract text from response
    text = response.text_annotations[0].description if response.text_annotations else ""
    return text.replace("\n", " ")  # Replace newlines with a space


def get_address_from_coordinates(lat, lon):
    api_key = os.getenv('GOOGLE_MAPS_API_KEY')
    url = f'https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={api_key}'
    
    response = requests.get(url)
    result = response.json()
    
    if response.status_code == 200 and result['status'] == 'OK':
        return result['results'][0]['formatted_address']
    return "Address not found"

def extract_image_info(image):
   
    # Get bottom portion of image
    height = image.shape[0]

    bottom_crop = image[height-100:height, :]

    # Extract text using EasyOCR
    text = detect_text(bottom_crop)
    print("Extracted text:", text)  # Debug print
    
    # Separate patterns for date and time
    date_pattern = re.compile(r'(\d{2}-\d{2}-\d{4})')
    time_pattern = re.compile(r'(\d{2}:\d{2}:\d{2})')
    date_match = date_pattern.search(text)
    time_match = time_pattern.search(text)

    # Updated pattern to match the specific format with km/h
    longitude_pattern = re.compile(r'km/h\s*E\s*(\d+\s*\.\s*\d+)')
    latitude_pattern = re.compile(r',\s*[№N]\s*(\d+\s*\.\s*\d+)')  # Updated to capture potential spaces and both '№' and 'N'
    
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

# Add these lines near the top of the file with your model loading
MODELS = {
    'yolov8': "yolo8_100epochs.pt",
    'yolov11': "SEA_yolo11_200epochs.pt"
}

@app.route('/stop-detection', methods=['POST'])
def stop_detection():
    global is_detection_stopped
    is_detection_stopped = True  # Set the flag to stop detection
    return jsonify({'message': 'Detection stopped'}), 200

@app.route('/detect-potholes', methods=['POST'])
def detect_potholes():
    global is_detection_stopped
    is_detection_stopped = False  # Reset the stop flag at the start
    
    # Get the selected model from the request, default to YOLOv8 if not specified
    selected_model = request.form.get('model', 'yolov11')
    
    # Load the selected model
    model_path = MODELS.get(selected_model)
    if not model_path:
        return jsonify({'error': 'Invalid model selected'}), 400
    
    model = YOLO(model_path)

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
        annotated_frames = []  # Store annotated frames
        last_info = {
        'date': None,
        'time': None,
        'latitude': None,
        'longitude': None,
        'address': None
        }
      
        if is_video:
            # Process video
            cap = cv2.VideoCapture(filepath)
            frame_count = 0
            
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                if is_detection_stopped:  # Check if detection should stop
                    break

                if frame_count % 30 == 0:  # Process every 30th frame (1 fps)
                    info = extract_image_info(frame)

                    if info.get("latitude") == last_info.get("latitude") and info.get("longitude") == last_info.get("longitude"):
                        frame_count += 1
                        last_info = info
                        continue
                    else:
                        results = model(frame)
                    last_info = info
                    
                    # Process results
                    if results and len(results) > 0:
                        result = results[0]
                        detection_data = sv.Detections.from_ultralytics(result)
                        
                        # Only process frames with detections
                        if len(detection_data) > 0:
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
                        results = None
                frame_count += 1
            
            cap.release()

        else:
            # Process image
            frame = cv2.imread(filepath)
            if is_detection_stopped:  # Check if detection should stop
                return jsonify({'error': 'Detection stopped'}), 200

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
                    annotated_frames.append({
                        "info": info,
                        "image": frame_base64,
                        "detections_count": len(detection_data)
                    })
            
        return jsonify({
            "frames": annotated_frames,
            "total_frames": len(annotated_frames)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Clean up temporary file
        if os.path.exists(filepath):
            os.remove(filepath)

if __name__ == '__main__':
    app.run(debug=True, port=5000) 