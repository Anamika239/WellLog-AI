import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import Select from 'react-select';
import './App.css';

const API_BASE_URL = 'https://welllog-ai-fdxt.onrender.com';

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [curves, setCurves] = useState([]);
  const [selectedCurves, setSelectedCurves] = useState([]);
  const [depthRange, setDepthRange] = useState({ min: 0, max: 0 });
  const [selectedDepthRange, setSelectedDepthRange] = useState({ min: 0, max: 0 });
  const [chartData, setChartData] = useState({});
  const [interpretation, setInterpretation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');

  // Keep dark mode permanently
  const [darkMode] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('Failed to connect to backend');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadProgress(0);
    setFilename(file.name);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      
      fetchFiles();
      setSelectedFile(response.data.fileId);
      setCurves(response.data.curves);
      setDepthRange(response.data.depthRange);
      setSelectedDepthRange(response.data.depthRange);
      
      setError('');
      alert('File uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      setError('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (fileId) => {
    setSelectedFile(fileId);
    setSelectedCurves([]);
    setChartData({});
    setInterpretation(null);
    setError('');

    try {
      const [curvesRes, depthRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/files/${fileId}/curves`),
        axios.get(`${API_BASE_URL}/api/files/${fileId}/depth-range`)
      ]);

      setCurves(curvesRes.data);
      setDepthRange(depthRes.data);
      setSelectedDepthRange(depthRes.data);
      
      const file = files.find(f => f.id === fileId);
      if (file) setFilename(file.filename);
    } catch (error) {
      console.error('Error loading file data:', error);
      setError('Failed to load file data');
    }
  };

  const loadChartData = async () => {
    if (!selectedFile || selectedCurves.length === 0) {
      setError('Please select a file and at least one curve');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/files/${selectedFile}/data`, {
        params: {
          curves: selectedCurves.join(','),
          minDepth: selectedDepthRange.min,
          maxDepth: selectedDepthRange.max
        }
      });
      
      setChartData(response.data);
    } catch (error) {
      console.error('Error loading chart data:', error);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  const runInterpretation = async () => {
    if (!selectedFile || selectedCurves.length === 0) {
      setError('Please select a file and at least one curve');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/interpret`, {
        fileId: selectedFile,
        curves: selectedCurves,
        minDepth: selectedDepthRange.min,
        maxDepth: selectedDepthRange.max
      });
      
      console.log('Interpretation response:', response.data);
      setInterpretation(response.data);
    } catch (error) {
      console.error('Error running interpretation:', error);
      setError('Interpretation failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = () => {
    if (Object.keys(chartData).length === 0) return [];

    const depths = new Set();
    Object.values(chartData).forEach(curveData => {
      curveData.forEach(point => depths.add(point.depth));
    });

    const sortedDepths = Array.from(depths).sort((a, b) => a - b);
    return sortedDepths.map(depth => {
      const point = { depth };
      Object.keys(chartData).forEach(curve => {
        const curvePoint = chartData[curve].find(p => p.depth === depth);
        point[curve] = curvePoint ? curvePoint.value : null;
      });
      return point;
    });
  };

  const getCurveColor = (index) => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffe66d', '#ff9ff6', '#feca57', '#ff6b9d'];
    return colors[index % colors.length];
  };

  const curveOptions = curves.map((curve, index) => ({ 
    value: curve, 
    label: curve,
    color: getCurveColor(index)
  }));

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <nav className="navbar">
        <div className="nav-brand">
          <h1>WellLog AI</h1>
        </div>
      </nav>

      <div className="main-container">
        <div className="sidebar">
          <div className="sidebar-section upload-section">
            <h3>Upload Data</h3>
            <div className="file-upload">
              <input
                type="file"
                accept=".las"
                onChange={handleFileUpload}
                disabled={uploading}
                id="file-input"
              />
              <label htmlFor="file-input" className="file-label">
                {uploading ? 'Uploading...' : 'Choose LAS File'}
              </label>
              {filename && <span className="file-name">{filename}</span>}
            </div>
            {uploading && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                  <span className="progress-text">{uploadProgress}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h3>Files</h3>
            <select 
              className="file-select"
              onChange={(e) => handleFileSelect(e.target.value)}
              value={selectedFile || ''}
            >
              <option value="">Select a file</option>
              {files.map(file => (
                <option key={file.id} value={file.id}>
                  {file.filename}
                </option>
              ))}
            </select>
          </div>

          {curves.length > 0 && (
            <>
              <div className="sidebar-section">
                <h3>Curves</h3>
                <Select
                  isMulti
                  options={curveOptions}
                  value={selectedCurves.map(c => ({ value: c, label: c }))}
                  onChange={(selected) => setSelectedCurves(selected.map(s => s.value))}
                  className="curve-select"
                  classNamePrefix="select"
                  placeholder="Select curves..."
                  styles={{
                    multiValue: (styles, { data }) => ({
                      ...styles,
                      backgroundColor: data.color,
                      color: 'white',
                    }),
                  }}
                />
              </div>

              <div className="sidebar-section">
                <h3>Depth Range (ft)</h3>
                <div className="depth-inputs">
                  <div className="input-group">
                    <label>Min</label>
                    <input
                      type="number"
                      value={selectedDepthRange.min}
                      onChange={(e) => setSelectedDepthRange({
                        ...selectedDepthRange,
                        min: parseFloat(e.target.value) || 0
                      })}
                      step="1"
                    />
                  </div>
                  <div className="input-group">
                    <label>Max</label>
                    <input
                      type="number"
                      value={selectedDepthRange.max}
                      onChange={(e) => setSelectedDepthRange({
                        ...selectedDepthRange,
                        max: parseFloat(e.target.value) || 0
                      })}
                      step="1"
                    />
                  </div>
                </div>
              </div>

              <div className="action-buttons">
                <button 
                  className="btn btn-primary" 
                  onClick={loadChartData}
                  disabled={selectedCurves.length === 0 || loading}
                >
                  {loading ? <span className="spinner"></span> : 'Load Data'}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={runInterpretation}
                  disabled={selectedCurves.length === 0 || loading}
                >
                  {loading ? <span className="spinner"></span> : 'AI Analyze'}
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="content">
          {Object.keys(chartData).length > 0 && (
            <div className="chart-card">
              <div className="chart-header">
                <h3>Well Log Visualization</h3>
                <span className="badge">
                  {Object.values(chartData).reduce((acc, curr) => acc + curr.length, 0)} measurements
                </span>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={prepareChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis 
                      dataKey="depth" 
                      label={{ value: 'Depth (ft)', position: 'insideBottom', offset: -5 }}
                      stroke="#888"
                    />
                    <YAxis label={{ value: 'Value', angle: -90, position: 'insideLeft' }} stroke="#888" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    <Brush dataKey="depth" height={30} stroke="#4ecdc4" />
                    {selectedCurves.map((curve, index) => (
                      <Line
                        key={curve}
                        type="monotone"
                        dataKey={curve}
                        stroke={getCurveColor(index)}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: getCurveColor(index) }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {interpretation && (
            <div className="interpretation-card">
              <h3>AI Insights</h3>
              <div className="depth-badge">
                Depth: {interpretation.depthRange?.min}ft - {interpretation.depthRange?.max}ft
              </div>
              
              <div className="insights-grid">
                {interpretation.interpretations && Object.keys(interpretation.interpretations).map(curve => {
                  const data = interpretation.interpretations[curve];
                  const hasAnomalies = data.anomalies && data.anomalies.length > 0;
                  
                  return (
                    <div key={curve} className={`insight-card ${hasAnomalies ? 'has-anomalies' : ''}`}>
                      <h4>{curve}</h4>
                      <div className="stats">
                        <div className="stat-row">
                          <span>Average</span>
                          <strong>{data.statistics?.average || 'N/A'}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Min/Max</span>
                          <strong>{data.statistics?.minimum || 'N/A'} / {data.statistics?.maximum || 'N/A'}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Std Dev</span>
                          <strong>{data.statistics?.stdDeviation || 'N/A'}</strong>
                        </div>
                        <div className="stat-row">
                          <span>Points</span>
                          <strong>{data.statistics?.points || 'N/A'}</strong>
                        </div>
                      </div>
                      
                      {hasAnomalies && (
                        <div className="anomalies">
                          <div className="anomaly-count">
                            {data.anomalies.length} peaks detected
                          </div>
                          <div className="anomaly-list">
                            {data.anomalies.slice(0, 3).map((a, i) => (
                              <div key={i} className="anomaly-item">
                                <span>{a.depth}ft</span>
                                <span>{a.value}</span>
                                <span className="deviation">{a.deviation}σ</span>
                              </div>
                            ))}
                            {data.anomalies.length > 3 && (
                              <div className="more">+{data.anomalies.length - 3} more...</div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="summary">{data.summary || 'No summary available'}</div>
                    </div>
                  );
                })}
              </div>

              {interpretation.recommendations && interpretation.recommendations.length > 0 && (
                <div className="recommendations">
                  <h4>Recommendations</h4>
                  <ul>
                    {interpretation.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;