const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = 5001;

// Middleware
// In your backend server.js, update CORS:
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://welllog-ai-2.orender.com',
    'https://welllog-ai-fdxt.onrender.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Ensure directories exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('database')) fs.mkdirSync('database');

// Database setup
const db = new sqlite3.Database('./database/well_data.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    upload_date TEXT,
    file_path TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS well_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER,
    depth REAL,
    curve_name TEXT,
    value REAL
  )`);
  
  console.log('✅ Database ready');
});

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});

// ============================================
// STREAMING LAS PARSER - NO STACK OVERFLOW
// ============================================
async function parseLASStream(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('📄 Streaming parse started...');
      
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let curves = [];
      let data = [];
      let inData = false;
      let lineCount = 0;
      let dataPointCount = 0;
      let minDepth = Infinity;
      let maxDepth = -Infinity;
      
      rl.on('line', (line) => {
        lineCount++;
        line = line.trim();
        
        // Skip empty lines and comments
        if (line.length === 0 || line.startsWith('#')) return;
        
        // Check for section headers
        if (line.startsWith('~C')) {
          inData = false;
          return;
        }
        if (line.startsWith('~A') || line.startsWith('~ASCII') || line.startsWith('~DATA')) {
          inData = true;
          return;
        }
        
        // Parse curve definitions (before data section)
        if (!inData && line.includes('.')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2 && parts[0] && !parts[0].includes('DEPT')) {
            const curveName = parts[0].replace('.', '').replace(/[^A-Za-z0-9]/g, '');
            if (!curves.includes(curveName)) {
              curves.push(curveName);
            }
          }
          return;
        }
        
        // Parse data lines
        if (inData) {
          const values = line.split(/\s+/).filter(v => v.length > 0);
          if (values.length > 1) {
            const depth = parseFloat(values[0]);
            if (!isNaN(depth)) {
              // Update depth range
              if (depth < minDepth) minDepth = depth;
              if (depth > maxDepth) maxDepth = depth;
              
              // Process each curve value
              for (let i = 1; i < values.length; i++) {
                if (curves[i-1]) {
                  const value = parseFloat(values[i]);
                  if (!isNaN(value)) {
                    data.push({
                      depth: depth,
                      curveName: curves[i-1],
                      value: value
                    });
                    dataPointCount++;
                    
                    // Progress indicator every 100k points
                    if (dataPointCount % 100000 === 0) {
                      console.log(`📊 Processed ${dataPointCount} data points...`);
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      rl.on('close', () => {
        console.log(`\n✅ Parse complete:`);
        console.log(`   • Lines read: ${lineCount}`);
        console.log(`   • Curves found: ${curves.length}`);
        console.log(`   • Data points: ${dataPointCount}`);
        console.log(`   • Depth range: ${minDepth} - ${maxDepth}`);
        
        resolve({
          curves,
          data,
          depthRange: { min: minDepth, max: maxDepth }
        });
      });
      
      rl.on('error', (err) => {
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Get all files
app.get('/api/files', (req, res) => {
  db.all('SELECT id, filename, upload_date FROM files', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Get curves for a file
app.get('/api/files/:fileId/curves', (req, res) => {
  db.all('SELECT DISTINCT curve_name FROM well_data WHERE file_id = ?', 
    [req.params.fileId], 
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.curve_name));
  });
});

// Get depth range
app.get('/api/files/:fileId/depth-range', (req, res) => {
  db.get('SELECT MIN(depth) as minDepth, MAX(depth) as maxDepth FROM well_data WHERE file_id = ?',
    [req.params.fileId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
  });
});

// Get curve data
app.get('/api/files/:fileId/data', (req, res) => {
  const { curves, minDepth, maxDepth } = req.query;
  const curveList = curves.split(',');
  
  db.all(
    `SELECT depth, curve_name, value FROM well_data 
     WHERE file_id = ? AND curve_name IN (${curveList.map(() => '?').join(',')})
     AND depth BETWEEN ? AND ?`,
    [req.params.fileId, ...curveList, parseFloat(minDepth), parseFloat(maxDepth)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const result = {};
      rows.forEach(row => {
        if (!result[row.curve_name]) result[row.curve_name] = [];
        result[row.curve_name].push({ depth: row.depth, value: row.value });
      });
      res.json(result);
  });
});

// Upload file - USING STREAMING PARSER
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('\n📥 Upload started:', req.file.originalname);
    
    // Parse using streaming method (no stack overflow)
    const parsedData = await parseLASStream(req.file.path);
    
    // Save file info to database
    db.run('INSERT INTO files (filename, upload_date, file_path) VALUES (?, ?, ?)',
      [req.file.originalname, new Date().toISOString(), req.file.path],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: err.message });
        }
        
        const fileId = this.lastID;
        console.log(`💾 Saving ${parsedData.data.length} points to database...`);
        
        // Use batch insert for better performance
        const batchSize = 5000;
        const stmt = db.prepare('INSERT INTO well_data (file_id, depth, curve_name, value) VALUES (?, ?, ?, ?)');
        
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          let count = 0;
          for (const point of parsedData.data) {
            stmt.run(fileId, point.depth, point.curveName, point.value);
            count++;
            
            if (count % batchSize === 0) {
              db.run('COMMIT');
              db.run('BEGIN TRANSACTION');
              console.log(`💾 Saved ${count}/${parsedData.data.length} points...`);
            }
          }
          
          stmt.finalize();
          db.run('COMMIT');
        });
        
        console.log(`✅ Upload complete! File ID: ${fileId}`);
        
        res.json({ 
          message: 'Upload successful', 
          fileId,
          curves: parsedData.curves,
          depthRange: parsedData.depthRange,
          dataPoints: parsedData.data.length
        });
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Interpretation
app.post('/api/interpret', (req, res) => {
  const { fileId, curves, minDepth, maxDepth } = req.body;
  
  db.all(
    `SELECT depth, curve_name, value FROM well_data 
     WHERE file_id = ? AND curve_name IN (${curves.map(() => '?').join(',')})
     AND depth BETWEEN ? AND ?`,
    [fileId, ...curves, parseFloat(minDepth), parseFloat(maxDepth)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No data found' });
      }
      
      const result = {};
      rows.forEach(row => {
        if (!result[row.curve_name]) {
          result[row.curve_name] = { values: [], depths: [] };
        }
        result[row.curve_name].values.push(row.value);
        result[row.curve_name].depths.push(row.depth);
      });
      
      const interpretations = {};
      const recommendations = [];
      
      Object.keys(result).forEach(curve => {
        const values = result[curve].values;
        const depths = result[curve].depths;
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const stdDev = Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
        
        interpretations[curve] = {
          statistics: {
            average: avg.toFixed(2),
            minimum: min.toFixed(2),
            maximum: max.toFixed(2),
            stdDeviation: stdDev.toFixed(2),
            points: values.length
          },
          summary: `${curve}: ${values.length} points, range ${min.toFixed(2)} to ${max.toFixed(2)}`
        };
        
        if (max > avg + 2 * stdDev) {
          const maxIdx = values.indexOf(max);
          recommendations.push(`High peak in ${curve} at ${depths[maxIdx]}ft: ${max.toFixed(2)}`);
        }
      });
      
      res.json({
        depthRange: { min: minDepth, max: maxDepth },
        interpretations,
        recommendations
      });
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${path.resolve('uploads')}`);
  console.log(`🗄️  Database: ${path.resolve('database/well_data.db')}`);
  console.log(`📊 Using STREAMING parser - no stack overflow`);
  console.log('=================================\n');
});