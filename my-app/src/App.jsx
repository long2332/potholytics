import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FileUploadSection from './components/FileUploadSection';
import Comparison from './components/Comparison';


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<FileUploadSection />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/comparison" element={<Comparison />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
