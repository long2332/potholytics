import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <img src="src/assets/Potholytics Logo.png" alt="Potholytics" className="h-8" />
            </Link>
            <div className="flex gap-8">
              <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
              <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
              <Link to="/comparison" className="text-gray-700 hover:text-gray-900">Comparison</Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar; 