import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FileUploadSection = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResults, setDetectionResults] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [detections, setDetections] = useState([]);
  const [selectedModel, setSelectedModel] = useState('yolov11');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [isDetectionStopped, setIsDetectionStopped] = useState(false);


  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) {
        const url = URL.createObjectURL(selectedFile);
        setPreview(url);
      }
    }
  };

  const handleDetection = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setIsDetectionStopped(false);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', selectedModel);

      const response = await fetch('http://localhost:5000/detect-potholes', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const results = await response.json();
      setDetectionResults(results);
      setIsPanelOpen(true);
    } catch (error) {
      console.error('Error during detection:', error);
      alert('Failed to process the file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopDetection = async () => {
    try {
      const response = await fetch('http://localhost:5000/stop-detection', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop detection');
      }

      setIsDetectionStopped(true);
    } catch (error) {
      console.error('Error stopping detection:', error);
      alert('Failed to stop detection');
    }
  };


  const DetailModal = ({ isOpen, onClose, results }) => {
    if (!isOpen || selectedImageIndex === null) return null;

    const images = results.frames
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

              <div className="grid grid-cols-2 h-full">
                {/* Left side - Image */}
                <div className="p-8 flex items-center justify-center bg-gray-100">
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

                {/* Right side - Details */}
            <motion.div 
              key={selectedImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="p-8 overflow-y-auto"
            >
                  <h2 className="text-2xl font-bold mb-6">Detection Details</h2>
                  <div className="space-y-4">
                    <DetailRow label="Potholes Detected" value={currentImage.detections_count} />
                    <DetailRow label="Date" value={currentImage.info?.date ?? 'N/A'} />
                    <DetailRow label="Time" value={currentImage.info?.time ?? 'N/A'} />
                    <DetailRow label="Latitude" value={currentImage.info?.latitude ?? 'N/A'} />
                    <DetailRow label="Longitude" value={currentImage.info?.longitude ?? 'N/A'} />
                    <DetailRow label="Address" value={currentImage.info?.address ?? 'N/A'} />
                  </div>
            </motion.div>

                {/* Navigation buttons */}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const DetailRow = ({ label, value }) => (
    <div className="flex flex-col">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  const ResultsPanel = ({ results, isOpen, onClose }) => {
    if (!results) return null;

    const [selectedRows, setSelectedRows] = useState(new Set());

    const handleRowSelect = (index) => {
      const newSelectedRows = new Set(selectedRows);
      if (newSelectedRows.has(index)) {
        newSelectedRows.delete(index);
      } else {
        newSelectedRows.add(index);
      }
      setSelectedRows(newSelectedRows);
    };

    const handleDeleteSelected = () => {
      const updatedFrames = results.frames.filter((_, index) => !selectedRows.has(index));
      setDetectionResults(prevResults => ({
        ...prevResults,
        frames: updatedFrames
      }));
      setSelectedRows(new Set());
    };

    const handleRowClick = (index) => {
      setSelectedImageIndex(index);
      setShowDetailModal(true);
    };

    return (
      <AnimatePresence>
        {isOpen && !isProcessing && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg"
            style={{ height: '80vh', zIndex: 10 }}
          >
            <div 
              className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer"
              onClick={() => onClose()}
            />

            <div className="p-4 overflow-y-auto h-full">
              <h2 className="text-xl font-bold mb-4">Pothole Detections</h2>
              <div className="flex justify-between">
                <button 
                  onClick={handleDeleteSelected}
                  className="mt-4 mb-4 py-2 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                >
                  Delete Selected
                </button>
                <button 
                  onClick={() => alert('Submit action triggered!')}
                  className="mt-4 mb-4 py-2 px-4 rounded-lg bg-green-500 hover:bg-green-600 text-white"
                >
                  Submit
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Select</th>
                      <th className="px-4 py-2 text-left">Pothole #</th>
                      <th className="px-4 py-2 text-left">Image</th>
                      <th className="px-4 py-2 text-left">Potholes Detected</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Latitude</th>
                      <th className="px-4 py-2 text-left">Longitude</th>
                      <th className="px-4 py-2 text-left">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.frames && results.frames.map((frame, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input 
                            type="checkbox" 
                            checked={selectedRows.has(index)} 
                            onChange={() => handleRowSelect(index)} 
                          />
                        </td>
                        <td className="px-4 py-2">{index + 1}</td>
                        <td 
                          className="px-4 py-2 cursor-pointer" 
                          onClick={() => handleRowClick(index)}
                        >
                          <img 
                            src={`data:image/jpeg;base64,${frame.image}`}
                            alt={`Pothole ${index + 1}`}
                            className="h-20 w-auto rounded"
                          />
                        </td>
                        <td className="px-4 py-2">{frame.detections_count}</td>
                        <td className="px-4 py-2">{frame.info?.date ?? 'N/A'}</td>
                        <td className="px-4 py-2">{frame.info?.time ?? 'N/A'}</td>
                        <td className="px-4 py-2">{frame.info?.latitude ?? 'N/A'}</td>
                        <td className="px-4 py-2">{frame.info?.longitude ?? 'N/A'}</td>
                        <td className="px-4 py-2">{frame.info?.address ?? 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* No detections message */}
                {(!results.image && !results.frames) && (
                  <p className="text-center text-gray-500 mt-4">
                    No potholes detected in this file.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="text-red-500 font-medium mb-2">POTHOLE DETECTION</div>
        <h1 className="text-3xl font-bold mb-4">Upload Media Files</h1>
        <p className="text-gray-600">
          Upload your media files in MP4 or image format to detect potholes.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-4">
          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Detection Model
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="yolov11">YOLOv11n</option>
            <option value="yolov8">YOLOv8</option>
            
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
          <label 
            htmlFor="file-upload"
            className="cursor-pointer"
          >
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
              <button 
                className="absolute top-2 right-2 text-red-500"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button 
            className={`w-full py-2 px-4 rounded-lg ${
              file && !isProcessing
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!file || isProcessing}
            onClick={handleDetection}
          >
            {isProcessing ? 'Processing...' : 'Detect Potholes'}
          </button>
          {isProcessing && (
            <button 
              className="w-full mt-2 py-2 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white"
              onClick={handleStopDetection}
            >
              Stop Detection
            </button>
          )}
        </div>
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

      <ResultsPanel 
        results={detectionResults}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
      
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        results={detectionResults}
      />
    </div>
  );
};

export default FileUploadSection;