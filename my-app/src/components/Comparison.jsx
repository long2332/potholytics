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
  const [selectedImage, setSelectedImage] = useState(null); // State to hold the selected image for the modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); // State to control the detail modal
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // State to track the current image index
  const [selectedImageIndex, setSelectedImageIndex] = useState(null); // State to track the selected image index
  const [currentResults, setCurrentResults] = useState(null); // State to track which results are currently being viewed

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
                        <img 
                          src={`data:image/jpeg;base64,${frame.image}`} 
                          alt={`Model 1 Pothole ${index + 1}`} 
                          className="h-20 w-auto rounded cursor-pointer" 
                          onClick={() => {
                            setSelectedImage(`data:image/jpeg;base64,${frame.image}`);
                            setSelectedImageIndex(index);
                            setCurrentResults('model1'); // Set current results to model 1
                            setIsDetailModalOpen(true);
                          }}
                        />
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
                        <img 
                          src={`data:image/jpeg;base64,${frame.image}`} 
                          alt={`Model 2 Pothole ${index + 1}`} 
                          className="h-20 w-auto rounded cursor-pointer" 
                          onClick={() => {
                            setSelectedImage(`data:image/jpeg;base64,${frame.image}`);
                            setSelectedImageIndex(index);
                            setCurrentResults('model2'); // Set current results to model 2
                            setIsDetailModalOpen(true);
                          }}
                        />
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

  const DetailModal = ({ isOpen, onClose, results }) => {
    if (!isOpen || selectedImageIndex === null) return null;

    const images = results.frames;
    const currentImage = images[selectedImageIndex];
    const isFirstImage = selectedImageIndex === 0;
    const isLastImage = selectedImageIndex === images.length - 1;

    const handlePrevious = () => {
      if (!isFirstImage) {
        setSelectedImageIndex(prev => prev - 1);
      }
    };

    const handleNext = () => {
      if (!isLastImage) {
        setSelectedImageIndex(prev => prev + 1);
      }
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20"
          >
            <div className="bg-white rounded-lg w-11/12 h-5/6 max-w-7xl overflow-hidden relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Fullscreen Image */}
              <div className="flex items-center justify-center h-full">
                <motion.img
                  key={selectedImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  src={`data:image/jpeg;base64,${currentImage.image}`}
                  alt="Detection Detail"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              {/* Navigation Buttons */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrevious}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg 
                      ${isFirstImage ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'}`}
                    disabled={isFirstImage}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNext}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg 
                      ${isLastImage ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'}`}
                    disabled={isLastImage}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
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
          <option value="yolov11l">YOLOv11l (mAP@50: 54.6% | inference time: 13.8ms)</option>
          <option value="rt-detr">RT-DETR (mP@50: 49.3% | inference time: 19.6ms)</option>
          <option value="yolov11n">YOLOv11n (mAP@50: 49.0% | inference time: 4.4ms)</option>
          <option value="faster_rcnn">Faster R-CNN (mAP@50: 48.1% | inference time: 51.5ms)</option>
          <option value="detr">DETR (mAP@50: 27.2% | inference time: 46.14ms)</option>     
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
          <option value="yolov11l">YOLOv11l (mAP@50: 54.6% | inference time: 13.8ms)</option>
          <option value="rt-detr">RT-DETR (mP@50: 49.3% | inference time: 19.6ms)</option>
          <option value="yolov11n">YOLOv11n (mAP@50: 49.0% | inference time: 4.4ms)</option>
          <option value="faster_rcnn">Faster R-CNN (mAP@50: inference time: 48.1% | 51.5ms)</option>
          <option value="detr">DETR (mAP@50: 27.2% | inference time: 46.14ms)</option>     
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
        {isDetailModalOpen && (
          <DetailModal 
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            results={currentResults === 'model1' ? detectionResultsModel1 : detectionResultsModel2}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Comparison;
