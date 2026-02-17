const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5001;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// ============================================
// DIRECTORY SETUP
// ============================================
const uploadsDir = path.join(__dirname, 'uploads');
const databaseDir = path.join(__dirname, 'database');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });

// ============================================
// DATABASE SETUP
// ============================================
const dbPath = path.join(databaseDir, 'well_data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    upload_date TEXT NOT NULL,
    file_path TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS well_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    depth REAL NOT NULL,
    curve_name TEXT NOT NULL,
    value REAL NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_well_data_file_curve ON well_data(file_id, curve_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_well_data_depth ON well_data(depth)`);
  
  console.log('Database tables created/verified');
});

// ============================================
// MULTER CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.las')) {
      cb(null, true);
    } else {
      cb(new Error('Only LAS files are allowed'));
    }
  }
});

// ============================================
// LAS PARSER
// ============================================
function parseLASFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Reading LAS file...');
      
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      let curves = [];
      let data = [];
      let inData = false;
      let dataPointCount = 0;
      let minDepth = Infinity;
      let maxDepth = -Infinity;
      
      // Find curve names
      for (let i = 0; i < Math.min(200, lines.length); i++) {
        const line = lines[i].trim();
        if (line.startsWith('~A') || line.startsWith('~ASCII')) break;
        if (line.includes('.') && !line.startsWith('#')) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2 && parts[0] && !parts[0].includes('DEPT')) {
            const curveName = parts[0].replace(/[^A-Za-z0-9]/g, '');
            if (!curves.includes(curveName)) curves.push(curveName);
          }
        }
      }
      
      console.log(`Found ${curves.length} curves:`, curves);
      
      // Find data start
      let dataStartIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('~A') || lines[i].trim().startsWith('~ASCII')) {
          dataStartIndex = i + 1;
          break;
        }
      }
      
      // Parse data
      for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length === 0 || line.startsWith('#')) continue;
        
        const values = line.split(/\s+/).filter(v => v.length > 0);
        if (values.length > 1) {
          const depth = parseFloat(values[0]);
          if (!isNaN(depth)) {
            minDepth = Math.min(minDepth, depth);
            maxDepth = Math.max(maxDepth, depth);
            
            for (let j = 1; j < values.length; j++) {
              if (curves[j-1]) {
                const value = parseFloat(values[j]);
                if (!isNaN(value)) {
                  data.push({ depth, curveName: curves[j-1], value });
                  dataPointCount++;
                }
              }
            }
          }
        }
      }
      
      console.log(`Parsed ${dataPointCount} data points`);
      console.log(`Depth range: ${minDepth} - ${maxDepth}`);
      
      resolve({ curves, data, depthRange: { min: minDepth, max: maxDepth } });
      
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
  res.json({ status: 'OK', timestamp: new Date().toISOString(), port: PORT });
});

// Get all files
app.get('/api/files', (req, res) => {
  db.all('SELECT id, filename, upload_date FROM files ORDER BY upload_date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Get curves for a file
app.get('/api/files/:fileId/curves', (req, res) => {
  db.all('SELECT DISTINCT curve_name FROM well_data WHERE file_id = ? ORDER BY curve_name', 
    [req.params.fileId], 
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => r.curve_name));
  });
});

// Get depth range for a file
app.get('/api/files/:fileId/depth-range', (req, res) => {
  db.get('SELECT MIN(depth) as minDepth, MAX(depth) as maxDepth FROM well_data WHERE file_id = ?',
    [req.params.fileId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || { minDepth: 0, maxDepth: 0 });
  });
});

// Get curve data for visualization
app.get('/api/files/:fileId/data', (req, res) => {
  const { curves, minDepth, maxDepth } = req.query;
  if (!curves) return res.status(400).json({ error: 'No curves specified' });
  
  const curveList = curves.split(',');
  let query = `SELECT depth, curve_name, value FROM well_data 
               WHERE file_id = ? AND curve_name IN (${curveList.map(() => '?').join(',')})`;
  const params = [req.params.fileId, ...curveList];
  
  if (minDepth && maxDepth && minDepth !== 'undefined' && maxDepth !== 'undefined') {
    query += ` AND depth BETWEEN ? AND ?`;
    params.push(parseFloat(minDepth), parseFloat(maxDepth));
  }
  
  query += ` ORDER BY depth`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const result = {};
    rows.forEach(row => {
      if (!result[row.curve_name]) result[row.curve_name] = [];
      result[row.curve_name].push({ depth: row.depth, value: row.value });
    });
    res.json(result);
  });
});

// Upload LAS file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log('\nUploading:', req.file.originalname);
    const parsedData = await parseLASFile(req.file.path);
    
    db.run('INSERT INTO files (filename, upload_date, file_path) VALUES (?, ?, ?)',
      [req.file.originalname, new Date().toISOString(), req.file.path],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const fileId = this.lastID;
        const stmt = db.prepare('INSERT INTO well_data (file_id, depth, curve_name, value) VALUES (?, ?, ?, ?)');
        
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          for (const point of parsedData.data) {
            stmt.run(fileId, point.depth, point.curveName, point.value);
          }
          stmt.finalize();
          db.run('COMMIT');
        });
        
        res.json({ 
          message: 'Upload successful', 
          fileId,
          curves: parsedData.curves,
          depthRange: parsedData.depthRange,
          dataPoints: parsedData.data.length
        });
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// AI Interpretation
app.post('/api/interpret', (req, res) => {
  const { fileId, curves, minDepth, maxDepth } = req.body;
  if (!fileId || !curves?.length) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const placeholders = curves.map(() => '?').join(',');
  db.all(
    `SELECT depth, curve_name, value FROM well_data 
     WHERE file_id = ? AND curve_name IN (${placeholders})
     AND depth BETWEEN ? AND ? ORDER BY depth`,
    [fileId, ...curves, parseFloat(minDepth), parseFloat(maxDepth)],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) {
        return res.status(404).json({ error: 'No data found' });
      }
      
      const curveData = {};
      rows.forEach(row => {
        if (!curveData[row.curve_name]) {
          curveData[row.curve_name] = { values: [], depths: [] };
        }
        curveData[row.curve_name].values.push(row.value);
        curveData[row.curve_name].depths.push(row.depth);
      });
      
      const interpretations = {};
      const recommendations = [];
      
      Object.keys(curveData).forEach(curve => {
        const { values, depths } = curveData[curve];
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
          summary: `${curve}: ${values.length} points, avg=${avg.toFixed(2)}, range=[${min.toFixed(2)} to ${max.toFixed(2)}]`
        };
      });
      
      res.json({
        depthRange: { min: parseFloat(minDepth), max: parseFloat(maxDepth) },
        interpretations,
        recommendations
      });
  });
});

// ============================================
// DATABASE-POWERED CHATBOT (NO EMOJIS)
// ============================================
app.post('/api/chat', async (req, res) => {
  const { message, fileId } = req.body;
  
  console.log('Chat request:', message);
  
  if (!fileId) {
    return res.json({ 
      response: "Please select a file first from the dropdown menu." 
    });
  }
  
  try {
    const lowerMsg = message.toLowerCase();
    
    // Get file info
    const file = await new Promise((resolve) => {
      db.get('SELECT filename FROM files WHERE id = ?', [fileId], (err, row) => {
        resolve(row || { filename: 'Unknown' });
      });
    });
    
    // Get all curves
    const curves = await new Promise((resolve) => {
      db.all('SELECT DISTINCT curve_name FROM well_data WHERE file_id = ?', [fileId], (err, rows) => {
        resolve(rows.map(r => r.curve_name));
      });
    });
    
    // Get depth range
    const depthRange = await new Promise((resolve) => {
      db.get('SELECT MIN(depth) as minD, MAX(depth) as maxD FROM well_data WHERE file_id = ?', [fileId], (err, row) => {
        resolve(row || { minD: 0, maxD: 0 });
      });
    });
    
    const filename = file.filename;
    
    // ========================================
    // RESPONSES WITHOUT EMOJIS OR MARKDOWN
    // ========================================
    
    // Greeting
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return res.json({ 
        response: `Hello! I'm analyzing ${filename} with ${curves.length} curves from ${depthRange.minD}ft to ${depthRange.maxD}ft. Ask me about curves, depth, or hydrocarbons.` 
      });
    }
    
    // List all curves
    else if (lowerMsg.includes('curve') || lowerMsg.includes('list') || lowerMsg.includes('available')) {
      const curveList = curves.slice(0, 20).join(', ');
      const more = curves.length > 20 ? `\n... and ${curves.length - 20} more` : '';
      return res.json({ 
        response: `Available Curves (${curves.length} total):\n${curveList}${more}` 
      });
    }
    
    // Depth range
    else if (lowerMsg.includes('depth') || lowerMsg.includes('range')) {
      return res.json({ 
        response: `Depth Range: ${depthRange.minD}ft - ${depthRange.maxD}ft (${(depthRange.maxD - depthRange.minD).toFixed(0)}ft interval)` 
      });
    }
    
    // HC5 specific
    else if (lowerMsg.includes('hc5')) {
      const stats = await new Promise((resolve) => {
        db.get(`SELECT 
                  COUNT(*) as count, 
                  AVG(value) as avg, 
                  MIN(value) as min, 
                  MAX(value) as max,
                  SUM(CASE WHEN value > 1000 THEN 1 ELSE 0 END) as peaks
                FROM well_data 
                WHERE file_id = ? AND curve_name = 'HC5'`, 
          [fileId], (err, row) => {
          resolve(row);
        });
      });
      
      if (stats && stats.count > 0) {
        return res.json({ 
          response: `HC5 Statistics:\n` +
            `Data Points: ${stats.count}\n` +
            `Average: ${stats.avg.toFixed(2)}\n` +
            `Minimum: ${stats.min.toFixed(2)}\n` +
            `Maximum: ${stats.max.toFixed(2)}\n` +
            `High Peaks (>1000): ${stats.peaks || 0}` 
        });
      } else {
        return res.json({ response: "HC5 curve not found in this file." });
      }
    }
    
    // Hydrocarbon zones
    else if (lowerMsg.includes('hydrocarbon') || lowerMsg.includes('peak') || 
             lowerMsg.includes('oil') || lowerMsg.includes('gas') || lowerMsg.includes('show')) {
      
      const hcCurves = curves.filter(c => 
        c.includes('HC') || c.includes('Xylene') || c.includes('Arom') || c.includes('C5')
      );
      
      if (hcCurves.length === 0) {
        return res.json({ 
          response: `No obvious hydrocarbon curves found. Available curves: ${curves.slice(0, 10).join(', ')}` 
        });
      }
      
      const placeholders = hcCurves.map(() => '?').join(',');
      const peaks = await new Promise((resolve) => {
        db.all(`SELECT curve_name, depth, value FROM well_data 
                WHERE file_id = ? AND curve_name IN (${placeholders}) 
                ORDER BY value DESC LIMIT 5`,
          [fileId, ...hcCurves], (err, rows) => {
          resolve(rows || []);
        });
      });
      
      let response = `Hydrocarbon Indicators Found:\n`;
      response += `Curves: ${hcCurves.join(', ')}\n\n`;
      
      if (peaks.length > 0) {
        response += `Top Peaks:\n`;
        peaks.forEach((p, i) => {
          response += `${i+1}. ${p.curve_name} at ${p.depth}ft: ${p.value.toFixed(2)}\n`;
        });
      } else {
        response += `No significant peaks found.`;
      }
      
      return res.json({ response });
    }
    
    // Help
    else if (lowerMsg.includes('help')) {
      return res.json({ 
        response: `I can help with:\n` +
          `- "List curves" - Show all available curves\n` +
          `- "Depth range" - Show min/max depth\n` +
          `- "HC5 statistics" - Get stats for HC5\n` +
          `- "Find hydrocarbon zones" - Detect oil/gas shows\n` +
          `- "Tell me about [curve name]" - Info about specific curve` 
      });
    }
    
    // Check if asking about a specific curve
    else {
      const mentionedCurve = curves.find(c => lowerMsg.includes(c.toLowerCase()));
      
      if (mentionedCurve) {
        const stats = await new Promise((resolve) => {
          db.get(`SELECT COUNT(*) as count, AVG(value) as avg, MIN(value) as min, MAX(value) as max 
                  FROM well_data WHERE file_id = ? AND curve_name = ?`,
            [fileId, mentionedCurve], (err, row) => {
            resolve(row);
          });
        });
        
        if (stats && stats.count > 0) {
          return res.json({ 
            response: `${mentionedCurve} Statistics:\n` +
              `Points: ${stats.count}\n` +
              `Average: ${stats.avg.toFixed(2)}\n` +
              `Min: ${stats.min.toFixed(2)}\n` +
              `Max: ${stats.max.toFixed(2)}` 
          });
        }
      }
      
      // Default response
      return res.json({ 
        response: `I'm analyzing ${filename} with ${curves.length} curves. Try asking about curves, depth, or hydrocarbons.` 
      });
    }
    
  } catch (error) {
    console.error('Chatbot error:', error);
    res.json({ 
      response: "Sorry, I encountered an error. Please try again." 
    });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(50));
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Uploads: ${uploadsDir}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Chatbot: ACTIVE (database-powered)`);
  console.log('='.repeat(50) + '\n');
});