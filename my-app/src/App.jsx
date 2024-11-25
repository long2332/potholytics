import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Navbar from './components/Navbar';
import FileUploadSection from './components/FileUploadSection';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <FileUploadSection />
      </div>
    </Router>
  );
}

export default App;
