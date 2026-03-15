import React, { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import './App.css';
const API_BASE_URL = import.meta.env.VITE_API_URL;
export default function App() {
  const globeEl = useRef();
  
  // NOAA Aurora Data
  const [auroraData, setAuroraData] = useState([]);
  const [auroraLoading, setAuroraLoading] = useState(true);
  const [auroraError, setAuroraError] = useState(null);
  
  // Alert State
  const [alertLoc, setAlertLoc] = useState(null); 
  const [alertEmail, setAlertEmail] = useState(""); 
  const [alertStatus, setAlertStatus] = useState(null); 
  const [alertThreshold, setAlertThreshold] = useState(60); // <-- ADDED THRESHOLD STATE

  // Telemetry Data
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    bz: 0,
    status: 'Connecting...',
    source: 'DSCOVR',
    last_updated: '--:--:--',
    substorm_warning: false, 
  });
  const [telemetryError, setTelemetryError] = useState(null);

  // Photography Advisor State
  const [photoIntensity, setPhotoIntensity] = useState('active');

  // Fetch NOAA OVATION Aurora Data (once on mount)
  useEffect(() => {
    const fetchAuroraData = async () => {
      try {
        setAuroraLoading(true);
        const response = await fetch(
          'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
        );
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        const processed = (data.coordinates || [])
          .filter(point => point && point[2] > 0)
          .map(point => ({
            lat: point[1],
            lng: point[0],
            probability: point[2],
          }));
        
        setAuroraData(processed);
        setAuroraError(null);
      } catch (error) {
        setAuroraError(error.message);
      } finally {
        setAuroraLoading(false);
      }
    };

    fetchAuroraData();
  }, []);

  // Fetch Telemetry Data (every 5 seconds)
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/telemetry`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        setTelemetry({
          speed: data.speed || 0,
          bz: data.bz || 0,
          status: data.status || 'Unknown',
          source: data.source || 'DSCOVR',
          last_updated: data.last_updated || new Date().toLocaleTimeString(),
          substorm_warning: data.substorm_warning || false, 
        });
        setTelemetryError(null);
      } catch (error) {
        setTelemetryError(error.message);
      }
    };

    fetchTelemetry();
    const intervalId = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Color functions
  const getAuroraColor = (probability) => {
    if (probability < 30) {
      const alpha = Math.max(0.1, (probability / 30) * 0.4);
      return `rgba(34, 197, 94, ${alpha})`;
    } else if (probability < 80) {
      const alpha = 0.4 + ((probability - 30) / 50) * 0.6;
      return `rgba(34, 197, 94, ${alpha})`;
    } else {
      const normalizedHigh = (probability - 80) / 20;
      const r = Math.round(34 + 220 * normalizedHigh);
      const g = Math.round(197 * (1 - normalizedHigh * 0.7));
      const b = Math.round(94 + 161 * normalizedHigh);
      const alpha = 0.7 + normalizedHigh * 0.3;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  };

  const hexBinColor = (bin) => {
    if (!bin || !bin.points || bin.points.length === 0) return 'rgba(100, 100, 100, 0.1)';
    const avgProbability = bin.points.reduce((sum, p) => sum + (p.probability || 0), 0) / bin.points.length;
    return getAuroraColor(avgProbability);
  };

  const getStatusColor = () => {
    if (telemetryError) return 'error';
    if (telemetry.status === 'Nominal') return 'nominal';
    if (telemetry.status === 'Warning') return 'warning';
    return 'error';
  };

// Updated Photography Advisor Logic
  const getDynamicIntensity = () => {
    // If Bz is very negative and speed is high, it's a STORM
    if (telemetry.bz < -10 || telemetry.speed > 600) return 'storm';
    // If Bz is moderately negative, it's ACTIVE
    if (telemetry.bz < -2) return 'active';
    // Otherwise, it's FAINT
    return 'faint';
  };

  // This determines the current recommendation automatically
  const currentLevel = getDynamicIntensity();

  const getCameraSettings = (level) => {
    switch(level) {
      case 'storm': return { iso: '800 - 1600', shutter: '2 - 5 sec', aperture: 'f/2.8' };
      case 'active': return { iso: '1600 - 3200', shutter: '8 - 10 sec', aperture: 'f/2.8' };
      case 'faint':
      default: return { iso: '3200 - 6400', shutter: '15 - 20 sec', aperture: 'f/2.8' };
    }
  };
  
  const camSettings = getCameraSettings(currentLevel);

  return (
    <div className="app-wrapper">
      {/* LEFT SIDEBAR */}
      <div className="sidebar" style={{ overflowY: 'auto', paddingRight: '10px' }}>
        
        {/* TELEMETRY PANEL */}
        <div className="panel telemetry-panel">
          <div className="panel-header">
            <div className="header-title">
              <span className={`status-dot status-${getStatusColor()}`}></span>
              <h2>TELEMETRY</h2>
            </div>
            <div className="source-tag">{telemetry.source}</div>
          </div>

          {telemetry.substorm_warning && (
            <div style={{
              background: 'rgba(255, 0, 51, 0.2)', border: '1px solid #ff0033', color: '#ff0033',
              padding: '12px', borderRadius: '6px', marginBottom: '15px', textAlign: 'center',
              fontWeight: 'bold', boxShadow: '0 0 15px rgba(255, 0, 51, 0.5)', animation: 'pulse 1.5s infinite' 
            }}>
              ⚠️ IMMINENT SUBSTORM: Sharp Bz Deflection Detected
            </div>
          )}

          <div className="telemetry-content">
            <div className="metric-card">
              <div className="metric-label">SPEED</div>
              <div className="metric-value">{telemetry.speed.toFixed(1)}</div>
              <div className="metric-unit">km/s</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Bz FIELD</div>
              <div className={`metric-value ${telemetry.bz < -5 ? 'critical' : ''}`}>
                {telemetry.bz.toFixed(2)}
              </div>
              <div className="metric-unit">nT</div>
            </div>
            <div className="metric-card full-width">
              <div className="metric-label">STATUS</div>
              <div className={`metric-value status-badge status-${telemetry.status.toLowerCase()}`}>
                {telemetry.status}
              </div>
            </div>
          </div>
        </div>

        {/* PROBABILITY SCALE */}
        <div className="panel legend-panel">
          <div className="panel-header"><h3>PROBABILITY SCALE</h3></div>
          <div className="legend-content">
            <div className="legend-row">
              <div className="legend-color low"></div>
              <div className="legend-text"><div className="legend-label">Low Probability</div></div>
            </div>
            <div className="legend-row">
              <div className="legend-color medium"></div>
              <div className="legend-text"><div className="legend-label">Medium Probability</div></div>
            </div>
            <div className="legend-row">
              <div className="legend-color high"></div>
              <div className="legend-text"><div className="legend-label">High Probability</div></div>
            </div>
          </div>
        </div>

        {/* PHOTOGRAPHY ADVISOR PANEL */}
        <div className="panel advisor-panel">
          <div className="panel-header">
            <h3>PHOTOGRAPHY ADVISOR</h3>
          </div>
          <div className="advisor-content">
            <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
               <button 
                  onClick={() => setPhotoIntensity('faint')} 
                  style={{ flex: 1, padding: '8px 5px', background: photoIntensity === 'faint' ? '#00ffcc' : 'transparent', color: photoIntensity === 'faint' ? 'black' : 'white', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
               >Faint</button>
               <button 
                  onClick={() => setPhotoIntensity('active')} 
                  style={{ flex: 1, padding: '8px 5px', background: photoIntensity === 'active' ? '#00ffcc' : 'transparent', color: photoIntensity === 'active' ? 'black' : 'white', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
               >Active</button>
               <button 
                  onClick={() => setPhotoIntensity('storm')} 
                  style={{ flex: 1, padding: '8px 5px', background: photoIntensity === 'storm' ? '#00ffcc' : 'transparent', color: photoIntensity === 'storm' ? 'black' : 'white', border: '1px solid #00ffcc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
               >Storm</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="metric-card">
                <div className="metric-label">ISO</div>
                <div className="metric-value" style={{ fontSize: '1.2rem' }}>{camSettings.iso}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">SHUTTER</div>
                <div className="metric-value" style={{ fontSize: '1.2rem' }}>{camSettings.shutter}</div>
              </div>
              <div className="metric-card full-width" style={{ gridColumn: 'span 2' }}>
                <div className="metric-label">APERTURE (WIDEST POSSIBLE)</div>
                <div className="metric-value" style={{ fontSize: '1.2rem' }}>{camSettings.aperture}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '12px', textAlign: 'center', fontStyle: 'italic' }}>
              *Set lens focus to infinity (∞) and use a sturdy tripod.
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <p>Space Weather Dashboard</p>
          <p className="subtitle">Real-time Aurora Forecast System</p>
        </div>
      </div>

      {/* GLOBE CONTAINER */}
      <div className="globe-container">
        <Globe
          ref={globeEl}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundColor="rgba(0, 0, 0, 1)"
          enableSunLight={true} 
          showAtmosphere={true}
          atmosphereAltitude={0.15}
          atmosphereColor="rgba(100, 150, 200, 0.2)"
          onGlobeClick={({ lat, lng }) => {
            setAlertLoc({ lat, lng });
            setAlertStatus(null);
          }}
          hexBinPointsData={auroraData}
          hexBinPointWeight="probability"
          hexBinResolution={3} 
          hexAltitude={(bin) => {
            if (!bin || !bin.points || bin.points.length === 0) return 0;
            const avgProb = bin.points.reduce((sum, p) => sum + (p.probability || 0), 0) / bin.points.length;
            return Math.max(0.02, (avgProb / 100) * 0.4); 
          }}
          hexTopColor={hexBinColor}
          hexSideColor={hexBinColor}
          hexBinMerge={true} 
        />
      </div>

      {/* POPUP UI WITH SLIDER */}
      {alertLoc && (
        <div className="overlay alert-popup" style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          background: 'rgba(15, 15, 20, 0.85)', backdropFilter: 'blur(12px)', padding: '25px', 
          borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', 
          zIndex: 100, width: '320px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#00ffcc', fontSize: '1.1rem' }}>SET ALERT SECTOR</h3>
            <button onClick={() => setAlertLoc(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
          </div>
          
          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem', color: '#aaa' }}>
            Latitude: {alertLoc.lat.toFixed(2)}° <br/> 
            Longitude: {alertLoc.lng.toFixed(2)}°
          </div>

          {/* --- NEW: THRESHOLD SLIDER --- */}
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: '#aaa' }}>
              Minimum Visibility Score: <span style={{ color: '#00ffcc', fontWeight: 'bold', fontSize: '1rem' }}>{alertThreshold}</span>
            </label>
            <input 
              type="range" 
              min="10" max="100" step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              style={{ width: '100%', marginTop: '8px', accentColor: '#00ffcc', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666' }}>
              <span>Faint</span>
              <span>Epic Storm</span>
            </div>
          </div>

          <input 
            type="email" placeholder="Enter your email..." value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            style={{ width: '100%', padding: '12px', marginBottom: '15px', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', color: 'white', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          
          <button 
            onClick={async () => {
              if (!alertEmail) return;
              setAlertStatus("Saving to Command Center...");
              try {
                const res = await fetch(`${API_BASE_URL}/api/subscribe`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    email: alertEmail, 
                    lat: alertLoc.lat, 
                    lon: alertLoc.lng, 
                    threshold: parseFloat(alertThreshold) // <-- NOW USING THE SLIDER VALUE
                  })
                });
                if (res.ok) {
                  setAlertStatus("Target Locked. Alert Set! 🚀");
                  setTimeout(() => setAlertLoc(null), 3000); 
                } else setAlertStatus("Communication Failure.");
              } catch (err) { setAlertStatus("Backend Offline."); }
            }}
            style={{ width: '100%', padding: '12px', background: '#00ffcc', color: 'black', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
          >
            {alertStatus || "SUBSCRIBE TO THIS SECTOR"}
          </button>
        </div>
      )}
    </div>
  );
}
