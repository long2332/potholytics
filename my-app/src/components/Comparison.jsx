import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadToBlob } from '../services/azureStorage'; // Import the uploadToBlob function

const Comparison = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResultsModel1, setDetectionResultsModel1] = useState(null);
  const [detectionResultsModel2, setDetectionResultsModel2] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedModel1, setSelectedModel1] = useState('');
  const [selectedModel2, setSelectedModel2] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
    }
  };

  const handleDetection = async (model, setResults) => {
    if (!file) return;

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', model);

      const response = await fetch('http://localhost:5000/detect-potholes', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const results = await response.json();
      setResults(results);
    } catch (error) {
      console.error('Error during detection:', error);
      alert('Failed to process the file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    // Prevent submission if models are the same or not selected
    if (selectedModel1 === selectedModel2) {
      alert('Please select different models for comparison.');
      return;
    }
    if (!selectedModel1 || !selectedModel2) {
      alert('Please select both models before proceeding.');
      return;
    }

    // Trigger detection for both models
    await handleDetection(selectedModel1, setDetectionResultsModel1);
    await handleDetection(selectedModel2, setDetectionResultsModel2);
    setIsPanelOpen(true);
    setShowResults(true); // Automatically show results when detection is complete
  };

  const ResultsPanel = ({ results1, results2, isOpen, onClose }) => {
    if (!isOpen || (!results1 && !results2)) return null;

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg" style={{ height: '80vh', zIndex: 10 }}>
        <div className="p-4 overflow-y-auto h-full">
        <div 
            className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer"
            onClick={() => onClose()}
        />
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Comparison Results</h2>
          </div>
          <div className="flex">
            <div className="w-1/2 p-2">
              <h3 className="font-bold">Model 1: {selectedModel1}</h3>
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-4 py-2">#</th>
                    <th className="border border-gray-300 px-4 py-2">Image</th>
                    <th className="border border-gray-300 px-4 py-2">Pothole Count</th>
                  </tr>
                </thead>
                <tbody>
                  {results1 && results1.frames.map((frame, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-2">
                        <img src={`data:image/jpeg;base64,${frame.image}`} alt={`Model 1 Pothole ${index + 1}`} className="h-20 w-auto rounded cursor-pointer" />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">{frame.detections_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="w-1/2 p-2">
              <h3 className="font-bold">Model 2: {selectedModel2}</h3>
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 px-4 py-2">#</th>
                    <th className="border border-gray-300 px-4 py-2">Image</th>
                    <th className="border border-gray-300 px-4 py-2">Pothole Count</th>
                  </tr>
                </thead>
                <tbody>
                  {results2 && results2.frames.map((frame, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-2">
                        <img src={`data:image/jpeg;base64,${frame.image}`} alt={`Model 2 Pothole ${index + 1}`} className="h-20 w-auto rounded cursor-pointer" />
                      </td>
                      <td className="border border-gray-300 px-4 py-2">{frame.detections_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleImageClick = (frames, index) => {
    // Open a modal or navigate to a detailed view of the selected image
    // This can be implemented as needed
    console.log('Image clicked:', frames[index]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Compare Pothole Detection Models</h1>
      <div className="mb-4">
        <label htmlFor="model1-select" className="block text-sm font-medium text-gray-700 mb-2">Select Detection Model 1</label>
        <select
          id="model1-select"
          value={selectedModel1}
          onChange={(e) => setSelectedModel1(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Model 1</option>
          <option value="yolov11n">YOLOv11n</option>
          <option value="yolov11l">YOLOv11l</option>
          <option value="rt-detr">RT-DETR</option>
          <option value="detr">DETR</option>
          <option value="faster_rcnn">Faster R-CNN</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="model2-select" className="block text-sm font-medium text-gray-700 mb-2">Select Detection Model 2</label>
        <select
          id="model2-select"
          value={selectedModel2}
          onChange={(e) => setSelectedModel2(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Model 2</option>
          <option value="yolov11n">YOLOv11n</option>
          <option value="yolov11l">YOLOv11l</option>
          <option value="rt-detr">RT-DETR</option>
          <option value="detr">DETR</option>
          <option value="faster_rcnn">Faster R-CNN</option>
        </select>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,video/mp4"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">📁</div>
            <div className="text-blue-500 hover:text-blue-600">Click to upload or drag and drop</div>
            <div className="text-sm text-gray-500">MP4 or Image files accepted</div>
          </div>
        </label>
        {preview && (
          <div className="mt-6 relative">
            <h3 className="font-medium mb-3">Preview:</h3>
            <div className="border rounded-lg p-4">
              {file?.type.startsWith('image/') ? (
                <img src={preview} alt="Preview" className="max-h-96 mx-auto" />
              ) : (
                <video src={preview} controls className="max-h-96 mx-auto">
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-6">
        <button
          className={`w-full py-2 px-4 rounded-lg ${file && !isProcessing ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          disabled={!file || isProcessing}
          onClick={handleSubmit}
        >
          {isProcessing ? 'Processing...' : 'Detect Potholes'}
        </button>
      </div>
        <button
        onClick={() => {
          if (!isProcessing) {
            setIsPanelOpen(!isPanelOpen);
          }
        }}
          className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 p-2 flex flex-col items-center gap-1"
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto cursor-pointer" />
          <div className="text-gray-600 font-medium">
          {isPanelOpen ? 'Hide Results' : 'Show Results'}
          </div>
        </button>
      <AnimatePresence>
        {isPanelOpen && (
          <ResultsPanel 
            results1={detectionResultsModel1}
            results2={detectionResultsModel2}
            isOpen={isPanelOpen}
            onClose={() => {
              setIsPanelOpen(false);
              setShowResults(false); // Hide results when panel is closed
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Comparison;
