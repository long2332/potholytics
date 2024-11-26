import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FileUploadSection = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResults, setDetectionResults] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [detections, setDetections] = useState([]);

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
      
      const formData = new FormData();
      formData.append('file', file);

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

  const ResultsPanel = ({ results, isOpen, onClose }) => {
    if (!results) return null;

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg"
            style={{ height: '60vh', zIndex: 1000 }}
          >
            <div 
              className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer"
              onClick={() => onClose()}
            />

            <div className="p-4 overflow-y-auto h-full">
              <h2 className="text-xl font-bold mb-4">Pothole Detections</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100">
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
                    {/* Handle single image case */}
                    {results.image && (
                      <tr className="border-b">
                        <td className="px-4 py-2">1</td>
                        <td className="px-4 py-2">
                          <img 
                            src={`data:image/jpeg;base64,${results.image}`}
                            alt="Detection Result"
                            className="h-20 w-auto rounded"
                          />
                        </td>
                        <td className="px-4 py-2">{results.detections_count}</td>
                        <td className="px-4 py-2">
                          {results.info?.date ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {results.info?.time ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {results.info?.latitude ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {results.info?.longitude ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {results.info?.address ?? 'N/A'}
                        </td>
                      </tr>
                    )}

                    {/* Handle video frames case */}
                    {results.frames && results.frames.map((frame, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2">{index + 1}</td>
                        <td className="px-4 py-2">
                          <img 
                            src={`data:image/jpeg;base64,${frame.image}`}
                            alt={`Pothole ${index + 1}`}
                            className="h-20 w-auto rounded"
                          />
                        </td>
                        <td className="px-4 py-2">{frame.detections_count}</td>
                        <td className="px-4 py-2">
                          {frame.info?.date ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {frame.info?.time ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {frame.info?.latitude ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {frame.info?.longitude ?? 'N/A'}
                        </td>
                        <td className="px-4 py-2">
                          {frame.info?.address ?? 'N/A'}
                        </td>
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
          </motion.div>
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
        </div>

        {preview && (
          <div className="mt-6">
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
        </div>
      </div>

      <ResultsPanel 
        results={detectionResults}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
};

export default FileUploadSection;