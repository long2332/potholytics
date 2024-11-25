import React, { useState } from 'react';

const FileUploadSection = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header section similar to the image */}
      <div className="mb-8">
        <div className="text-red-500 font-medium mb-2">MEDIA UPLOAD</div>
        <h1 className="text-3xl font-bold mb-4">Upload Media Files</h1>
        <p className="text-gray-600">
          Upload your media files in MP4 or image format.
        </p>
        <div className="flex items-center gap-2 text-gray-500 mt-4">
          <span>👁️ 0 views</span>
        </div>
      </div>

      {/* Upload section */}
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

        {/* Preview section */}
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

        {/* Upload button */}
        <div className="mt-6">
          <button 
            className={`w-full py-2 px-4 rounded-lg ${
              file 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!file}
          >
            Upload File
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUploadSection;