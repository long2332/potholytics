from flask import Flask, request, jsonify
from flask_cors import CORS
import supervision as sv
import numpy as np
from ultralytics import YOLO
import cv2
import os
from werkzeug.utils import secure_filename
import base64

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load the YOLO model
model = YOLO("yolo11_117_epochs_best.pt")

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def resize_image(image):
    # Calculate new dimensions (25% of original)
    width = int(image.shape[1] * 0.25)
    height = int(image.shape[0] * 0.25)
    
    # Resize image
    return cv2.resize(image, (width, height), interpolation=cv2.INTER_AREA)

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
            filestr = file.read()
            npimg = np.frombuffer(filestr, np.uint8)
            frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

            results = model(frame)
            
            if len(results) > 0:
                result = results[0]
                detection_data = sv.Detections.from_ultralytics(result)
                
                # Only process if there are detections
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
                    
                    # Convert frame to base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    return jsonify({
                        "image": frame_base64,
                        "detections_count": len(detection_data)
                    })
            
            return jsonify({
                "image": None,
                "detections_count": 0
            })

    except Exception as e:
        # Clean up temporary file if it exists
        if 'filepath' in locals() and os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000) 