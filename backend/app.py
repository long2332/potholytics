from flask import Flask, request, Response, jsonify
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
from pymongo import MongoClient
from azure.storage.blob import BlobServiceClient, BlobClient

load_dotenv(dotenv_path='../my-app/.env')

blob_service_url = f"https://{os.getenv('VITE_STORAGE_ACCOUNT_NAME')}.blob.core.windows.net"

# Initialize the BlobServiceClient
blob_service_client = BlobServiceClient(account_url=blob_service_url, credential=os.getenv('VITE_AZURE_SAS_TOKEN'))

# Get the container client
container_client = blob_service_client.get_container_client(os.getenv('VITE_CONTAINER_NAME'))


os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "melodic-argon-392105-53b6a5fcfdfe.json"
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
# model = YOLO("yolo11_117_epochs_best.pt")


# Add these lines near the top of the file with your model loading
MODELS = {
    'yolov11n': "SEA_yolo11n_200epochs.pt",
    'yolov11l': "SEA_yolo11l_best.pt",
    're-detr': "SEA_rt-detr.pt",
    'detr': "SEA_DETR_epoch=epoch=31-val_loss=val_loss=0.00.ckpt"
}

client = vision.ImageAnnotatorClient()
# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.getenv('VITE_GOOGLE_MAPS_API_KEY'):
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
    api_key = os.getenv('VITE_GOOGLE_MAPS_API_KEY')
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

def insert_frames(frames):
    try:
        # Create a MongoClient
        client = MongoClient(os.environ["MONGODB_URI"])

        # Connect to the database
        database = client["potholytics"]
        collection = database["potholes"]
        print("MongoDB connection successful")
        # Insert the frames into the collection
        result = collection.insert_many(frames)
        
        # Close the connection
        client.close()
        return(True)

    except Exception as e:
        print("Failed to connect to MongoDB:", e)


@app.route('/stop-detection', methods=['POST'])
def stop_detection():
    global is_detection_stopped
    is_detection_stopped = True  # Set the flag to stop detection
    return jsonify({'message': 'Detection stopped'}), 200

@app.route('/detect-potholes', methods=['POST'])
def detect_potholes():
    global is_detection_stopped
    is_detection_stopped = False  # Reset the stop flag at the start
    
    # Get the selected model from the request, default to YOLOv11n if not specified
    selected_model = request.form.get('model', 'yolov11n')
    
    # Load the selected model
    model_path = MODELS.get(selected_model)
    if not model_path:
        return jsonify({'error': 'Invalid model selected'}), 400
    if selected_model != "detr":
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
                            
                            annotated_frames.insert(0, {
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
                    annotated_frames.insert(0, {
                        "info": info,
                        "image": frame_base64,
                        "detections_count": len(detection_data)
                    })
        return jsonify({
            "frames": annotated_frames
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        # Clean up temporary file
        if os.path.exists(filepath):
            os.remove(filepath)

@app.route('/save-detections', methods=['POST'])
def save_detections():
    try:
        frames = request.json
        insert_result = insert_frames(frames)  # Call the insert_frames function
        if insert_result:
            return jsonify({'message': 'Detections saved successfully!'}), 201
        else:
            print("Error")
            return jsonify({'message': 'Failed to save detections'}), 500
    except Exception as e:
        print("Error saving detections:", e)
        return jsonify({'message': 'Failed to save detections'}), 500
@app.route('/get-pothole-data', methods=['GET'])
def get_pothole_data():
    try:
        # Create a MongoClient
        client = MongoClient(os.environ["MONGODB_URI"])
        database = client["potholytics"]
        collection = database["potholes"]
        
        # Retrieve all documents from the collection
        pothole_data = list(collection.find({}))
        
        # Convert ObjectId to string
        for pothole in pothole_data:
            pothole['_id'] = str(pothole['_id'])  # Convert ObjectId to string
        
        # Close the connection
        client.close()
        
        # Return the data as JSON
        return jsonify(pothole_data), 200
    except Exception as e:
        print("Error retrieving data:", e)
        return jsonify({'error': 'Failed to retrieve data'}), 500

def retrieve_image(blob_url):
    container_client = blob_service_client.get_container_client(os.getenv("VITE_CONTAINER_NAME"))
    blob_name = blob_url.split("/").pop().split("?")[0]
    blob_data = container_client.download_blob(blob_name)
    image_data = blob_data.readall()  # Read the blob data into memory
    return image_data

# Flask route to fetch the image and return it as Base64
@app.route('/get_image', methods=['GET'])
def get_image():
    # Extract the blob URL from the query parameters
    blob_url = request.args.get('blob_url')
    print(blob_url)

    if not blob_url:
        return jsonify({"error": "No blob_url provided"}), 400
    
    try:
        # Retrieve the image data as bytes
        image_data = retrieve_image(blob_url)
        
        # Encode the image data to Base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')  # Decode to get a string

        # Return the Base64 string as a JSON response
        return jsonify({"image_base64": image_base64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
