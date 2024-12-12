import React from 'react';
import {APIProvider, Map, AdvancedMarker, Pin, InfoWindow} from '@vis.gl/react-google-maps';
const Dashboard = () => {

  const mapContainerStyle = {
    height: "400px",
    width: "100%"
  };

  const center = {
    lat: 3.139,
    lng: 101.6869
  };

  const markers = [
    {key: '1', location: { lat: 3.139, lng: 101.6869 }},
    {key: '2', location: { lat: 3.173, lng: 101.7065 }},
    {key: '3', location: { lat: 2.9900, lng: 101.7000 }},
    {key: '4', location:  { lat: 1.4921, lng: 103.7414 }},
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome to the dashboard! Here you can view your pothole detection statistics.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Total Potholes Detected</h2>
          <p className="text-2xl font-bold">150</p>
        </div>

      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Pothole Detections</h2>
        <table className="min-w-full table-auto bg-white rounded-lg shadow">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">Pothole #</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-4 py-2">1</td>
              <td className="px-4 py-2">2024-10-01</td>
              <td className="px-4 py-2">Cheras, Selangor</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-2">2</td>
              <td className="px-4 py-2">2024-10-02</td>
              <td className="px-4 py-2">Petaling Jaya, Selangor</td>
            </tr>
            {/* Add more rows as needed */}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Map of Pothole Locations</h2>
            <APIProvider apiKey="AIzaSyCF2bom3zeeMFeb8D8svVdf_tLVLD4rYfQ">
            <div style={{ height: "80vh", width: "100%" }}>
                       
                <Map zoom={9} zoomControl={true} center={center} mapId="8e700f7bc61d867b">
                <PoiMarkers pois={markers} />
                <Pin 
                background={'#FBBC04'} 
                glyphColor={'#000'} 
                borderColor={'#000'} />

                </Map>
            </div>
            </APIProvider>
      </div>
    </div>
  );
};

const PoiMarkers = ({pois}) => {
    return (
      <>
        {pois.map( (poi) => (
          <AdvancedMarker
            key={poi.key}
            position={poi.location}>
          <Pin background={'#FBBC04'} glyphColor={'#000'} borderColor={'#000'} />
          </AdvancedMarker>
        ))}
      </>
    );
  };


export default Dashboard;
