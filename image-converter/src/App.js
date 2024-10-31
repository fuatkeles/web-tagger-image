import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet'; // Leaflet'i içe aktarın
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { FaUpload, FaTimes, FaMapMarkerAlt, FaBars } from 'react-icons/fa'; // react-icons/fa modülünü içe aktar
import './App.css'; // Yeni CSS dosyasını içe aktar
import { FaCheckCircle } from 'react-icons/fa'; // Import the checkmark icon
import ReactDOMServer from 'react-dom/server'; // ReactDOMServer'ı içe aktarın
import { ReactComponent as Logo } from './assets/WebTagger.svg';
import { ProgressBar } from 'react-loader-spinner';

function LocationMarker({ location, setLocation }) {
  useMapEvents({
    click(e) {
      setLocation(e.latlng);
    },
  });

  return location ? (
    <Marker position={location} icon={L.divIcon({
      className: 'custom-icon',
      html: ReactDOMServer.renderToString(<FaMapMarkerAlt size={50} color="clack" />)
    })} />
  ) : null;
}

function SearchControl({ setLocation }) {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();

    const searchControl = new GeoSearchControl({
      provider,
      style: 'bar',
      showMarker: true,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
      marker: {
        icon: L.divIcon({
          className: 'custom-icon',
          html: ReactDOMServer.renderToString(<FaMapMarkerAlt size={50} color="black" />)
        })
      }
    });
    

    map.addControl(searchControl);

    map.on('geosearch/showlocation', (result) => {
      if (result && result.location) {
        setLocation({
          lat: result.location.y,
          lng: result.location.x
        });
      }
    });

    return () => map.removeControl(searchControl);
  }, [map, setLocation]);

  return null;
}

function App() {
  const [images, setImages] = useState([]);
  const [convertedImages, setConvertedImages] = useState({});
  const [location, setLocation] = useState(null);
  const [geotagged, setGeotagged] = useState({});
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileNames, setFileNames] = useState([]);
  const [loading, setLoading] = useState({}); // Add this line to the state declarations
  const [menuActive, setMenuActive] = useState(false);

  const toggleMenu = () => {
    setMenuActive(!menuActive);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    setFileNames(files.map(file => file.name.replace(/\.[^/.]+$/, ""))); // Uzantıyı kaldır
    setLoading(new Array(files.length).fill(false));
    setGeotagged(new Array(files.length).fill(false));
    setConvertedImages(new Array(files.length).fill(null));
  };

  const handleFileNameChange = (index, newFileName) => {
    const updatedFileNames = [...fileNames];
    updatedFileNames[index] = newFileName;
    setFileNames(updatedFileNames);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    setImages(files);
    setFileNames(files.map(file => file.name.replace(/\.[^/.]+$/, ""))); // Uzantıyı kaldır
    setIsDragActive(false);
  };

  
  const handleConvert = async (index) => {
    const formData = new FormData();
    formData.append('image', images[index]);

    try {
      const response = await axios.post('http://localhost:5001/convert', formData, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      setConvertedImages((prev) => ({ ...prev, [index]: url }));
    } catch (error) {
      console.error('Error converting image:', error);
    }
  };

  const handleAddGeotag = async (index) => {
    const originalFileName = fileNames[index];
    const newFileName = originalFileName.replace(/\s+/g, '-'); // Dosya adındaki boşlukları "-" ile değiştir
    if (!location) {
      console.error('Location is not set');
      return;
    }

    setLoading((prev) => ({ ...prev, [index]: true })); // Set loading to true for this image

    const formData = new FormData();
    formData.append('image', images[index]);
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);
    if (newFileName) {
      formData.append('newFileName', newFileName);
    }

    try {
      const response = await axios.post('http://localhost:5001/add-geotag', formData, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const altText = originalFileName; // Alt metin olarak orijinal dosya adını kullan
      setConvertedImages((prev) => ({ ...prev, [index]: { url, altText } }));
      setGeotagged((prev) => ({ ...prev, [index]: true }));
    } catch (error) {
      console.error('Error adding geotag:', error);
    } finally {
      setLoading((prev) => ({ ...prev, [index]: false })); // Set loading to false for this image
    }
  };

  const handleClear = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setConvertedImages((prev) => {
      const newConvertedImages = { ...prev };
      delete newConvertedImages[index];
      return newConvertedImages;
    });
    setGeotagged((prev) => {
      const newGeotagged = { ...prev };
      delete newGeotagged[index];
      return newGeotagged;
    });
  };

  const handleClearAll = () => {
    setImages([]);
    setConvertedImages({});
    setGeotagged({});
  };

  const getWebpFileName = (originalName, newFileName) => {
    if (newFileName) {
      const sanitizedFileName = newFileName.replace(/\s+/g, '-');
      return `${sanitizedFileName}.webp`;
    }
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "-");
    return `${nameWithoutExtension}.webp`;
  };
  

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const folder = zip.folder("images");
  
    // `convertedImages` nesnesini kontrol et
    for (const [index, imageData] of Object.entries(convertedImages)) {
      try {
        const response = await fetch(imageData.url);
  
        if (!response.ok) {
          console.error(`Failed to fetch image at index ${index}: ${response.statusText}`);
          continue;
        }
  
        const contentType = response.headers.get("Content-Type");
        if (!contentType || !contentType.includes("image")) {
          console.error(`Unexpected content type at index ${index}: ${contentType}`);
          continue;
        }
  
        const blob = await response.blob();
        const fileName = getWebpFileName(images[index]?.name || '', imageData.altText);
        folder.file(fileName, blob);
      } catch (error) {
        console.error(`Error fetching image at index ${index}: ${error.message}`);
      }
    }
  
    // Zip dosyasını oluştur ve indir
    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "images.zip");
    });
  };
  
  
  
  

  const allConvertedAndGeotagged = images.length > 0 && images.every((_, index) => geotagged[index]);


  return (
    <div className="app-container">
     <nav className="navbar">
        <div className="navbar-brand">
          <Logo />
        </div>
        <div className={`navbar-links ${menuActive ? 'active' : ''}`}>
          <a href="#about" className="navbar-link">About</a>
          <button className="navbar-button login-button">Login</button>
          <button className="navbar-button signup-button">Sign Up</button>
        </div>
        <div className="hamburger-menu" onClick={toggleMenu}>
          <FaBars size={24} />
        </div>
      </nav>
      <div className="top-container">
        <MapContainer center={[51.505, -0.09]} zoom={13} className="map-container">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker location={location} setLocation={setLocation} />
          <SearchControl setLocation={setLocation} />
        </MapContainer>
        <div
          className={`upload-container ${isDragActive ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FaUpload className="upload-icon" /> {/* Yükleme simgesi */}
          <input type="file" multiple onChange={handleFileChange} className="upload-input" />
          <label className="upload-label">You can also drag and drop files here.</label>
        </div>
      </div>
      <ul className={`image-list ${images.length === 0 ? 'empty' : ''}`}>
      {images.map((image, index) => (
  <li key={index} className="image-item">
    <img src={URL.createObjectURL(image)} alt={image.name} className="image-preview" />
    <span className="image-name">{image.name}</span>
    <div className="button-group">
      <input
        type="text"
        value={fileNames[index]}
        onChange={(e) => handleFileNameChange(index, e.target.value)}
        className="file-name-input"
        />
        
      {location && <button className="add-geotag-button" onClick={() => handleAddGeotag(index)}>Add Geotag</button>}
      {loading[index] && (
              <ProgressBar
                height="50"
                width="200"
                ariaLabel="progress-bar-loading"
                wrapperStyle={{}}
                wrapperClass="progress-bar-wrapper"
                borderColor="#000000"
                barColor="#44C4D4"
              />
            )}
      {geotagged[index] && (
  <>
    <a href={convertedImages[index].url} download={fileNames[index].replace(/\s+/g, '-')} className="ios-button">
  Download
</a>
    <FaCheckCircle className="checkmark-icon" /> {/* Add checkmark icon */}
  </>
)}
      <button className="clear-button" onClick={() => handleClear(index)}><FaTimes /></button>
    </div>
  </li>
))}
      </ul>
      
      {allConvertedAndGeotagged && (
        <div className="actions-container">
          <button className="ios-button" onClick={handleDownloadAll}>Download All</button>
          <button className="ios-button" onClick={handleClearAll}>Clear All</button>
        </div>
      )}

<footer className="footer">
  <div className="footer-content">
    <h2>How to Use</h2>
    <p>1. Upload your images by dragging and dropping them into the upload area or by clicking the upload button.</p>
    <p>2. Once uploaded, you can add geotags to your images by entering the location details.</p>
    <p>3. After adding geotags, you can download the images individually or all at once.</p>
  </div>
  <div className="copyright">
    &copy; 2024 <a href="https://www.linkedin.com/in/fuat-keles/" target="_blank" rel="noopener noreferrer">Fuat Keles</a>
  </div>
</footer>
    </div>
  );
}

export default App;