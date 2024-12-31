import React, { useEffect, useState } from 'react';
import {APIProvider, Map, AdvancedMarker, Pin, InfoWindow} from '@vis.gl/react-google-maps';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const Dashboard = () => {
  const [potholeData, setPotholeData] = useState([]);
  const [uniqueRecentDetections, setUniqueRecentDetections] = useState([]);
  const [selectedPothole, setSelectedPothole] = useState(null);
  const [potholeImage, setPotholeImage] = useState(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapID = import.meta.env.VITE_GOOGLE_MAPS_ID;

  useEffect(() => {
    const fetchPotholeData = async () => {
      try {
        const response = await fetch('http://localhost:5000/get-pothole-data');
        const data = await response.json();
        setPotholeData(data);
        const recentDetections = await getUniqueRecentDetections(data);
        setUniqueRecentDetections(recentDetections);
      } catch (error) {
        console.error('Error fetching pothole data:', error);
      }
    };

    fetchPotholeData();
  }, []);

  const getCityAndState = async (address) => {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
    const data = await response.json();

    if (data.status === 'OK') {
      const components = data.results[0].address_components;
      const city = components.find(comp => comp.types.includes('locality'))?.long_name || '';
      const state = components.find(comp => comp.types.includes('administrative_area_level_1'))?.short_name || '';
      return { city, state };
    }
    return { city: '', state: '' };
  };

  const getUniqueRecentDetections = async (data) => {
    const uniqueLocations = {};

    for (const pothole of data) {
      const { address } = pothole.info;
      const { city, state } = await getCityAndState(address);
      const key = `${city}, ${state}`;
      pothole.info.city = city;
      pothole.info.state = state;
      const imageUrl = String(pothole.image).split('?')[0];
      pothole.image = `${imageUrl}?${import.meta.env.VITE_AZURE_SAS_TOKEN}`;
      console.log(pothole.image)
      if (!uniqueLocations[key] && city && state) {
        uniqueLocations[key] = { ...pothole, city, state };
      }
    }
    const recentDetections = Object.values(uniqueLocations)
      .sort((a, b) => new Date(b.info.datetime) - new Date(a.info.datetime))
      .slice(0, 5);

    return recentDetections;
  };

  const getMostRecentDateTime = () => {
    if (potholeData.length === 0) return { date: null, time: null };

    let mostRecentDate = '';
    let mostRecentTime = '';

    potholeData.forEach(pothole => {
      const { date, time } = pothole.info;
      if (date && time) {
        const currentDate = new Date(date.split('-').reverse().join('-'));
        const recentDate = new Date(mostRecentDate.split('-').reverse().join('-') || '1970-01-01');

        if (currentDate > recentDate) {
          mostRecentDate = date;
          mostRecentTime = time;
        }
      }
    });

    return { date: mostRecentDate, time: mostRecentTime };
  };

  const { date: recentDate, time: recentTime } = getMostRecentDateTime();

  const mapContainerStyle = {
    height: "400px",
    width: "100%"
  };

  const center = {
    lat: 3.139,
    lng: 101.6869
  };

  const markers = potholeData.map((pothole, index) => ({
    key: index.toString(),
    location: { lat: pothole.info.latitude, lng: pothole.info.longitude },
    image: pothole.image
  }));

  const getPotholeCounts = (data) => {
    const stateCounts = {};
    const cityCounts = {};

    data.forEach(pothole => {
      const city = pothole.info.city;
      const state = pothole.info.state;

      stateCounts[state] = (stateCounts[state] || 0) + 1;
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    return { stateCounts, cityCounts };
  };

  const { stateCounts, cityCounts } = getPotholeCounts(potholeData);

  const stateChartData = {
    labels: Object.keys(stateCounts),
    datasets: [{
      label: 'Number of Potholes by State',
      data: Object.values(stateCounts),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
    }],
  };

  const cityChartData = {
    labels: Object.keys(cityCounts),
    datasets: [{
      label: 'Number of Potholes by City',
      data: Object.values(cityCounts),
      backgroundColor: 'rgba(153, 102, 255, 0.6)',
    }],
  };

  const handleMarkerClick = (imageUrl) => {
    setPotholeImage(imageUrl);
  };
  

  

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome to the dashboard! Here you can view your pothole detection statistics.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Total Potholes Detected</h2>
          <p className="text-2xl font-bold">{potholeData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Most Recent Detection</h2>
          <p className="text-xl font-bold">{recentDate} {recentTime}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Pothole Detections</h2>
        <table className="min-w-full table-auto bg-white rounded-lg shadow">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            {uniqueRecentDetections.map((pothole, index) => (
              <tr className="border-b" key={index}>
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2">{pothole.info.date}</td>
                <td className="px-4 py-2">{`${pothole.city}, ${pothole.state}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Potholes by State</h2>
          <Bar data={stateChartData} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold">Potholes by City</h2>
          <Bar data={cityChartData} />
        </div>
      </div>
      <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Map of Pothole Locations</h2>
      <APIProvider apiKey={apiKey}>
        <div style={{ height: "80vh", width: "100%" }}>
          <Map 
            defaultCenter={center}
            mapId= {mapID}
            zoomControl={true}
            scrollwheel={true}
            defaultZoom={9}
            draggable={true}
          >
            {markers.map(marker => (
              <AdvancedMarker
                key={marker.key}
                position={marker.location}
                onClick={() => {
                  setSelectedPothole(marker);
                  handleMarkerClick(marker.image);
                }}
              >
                <Pin background={'#FBBC04'} glyphColor={'#000'} borderColor={'#000'} />
              </AdvancedMarker>
            ))}
            {selectedPothole && potholeImage && (
              <InfoWindow
                position={selectedPothole.location}
                onCloseClick={() => {
                  setSelectedPothole(null);
                  setPotholeImage(null);
                }}
              >
                <div>
                <img 
                  src={potholeImage} 
                  alt="Pothole" 
                  className="rounded-lg shadow" 
                  style={{ width: '300px', height: '200px' }} // Set desired width and height
                />
                </div>
              </InfoWindow>
            )}
          </Map>
        </div>
      </APIProvider>
    </div>
    </div>
  );
};

export default Dashboard;
