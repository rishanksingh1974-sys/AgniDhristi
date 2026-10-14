const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
// CRITICAL DEPLOYMENT FIX: Read PORT from environment variable (required by Render, Heroku, Railway, Cloud Run, etc.)
const PORT = process.env.PORT || 3000;

app.use(express.json());

// DEPLOYMENT SECURITY: Prevent access to backend and sensitive files before static serving
app.use((req, res, next) => {
  const blockedPaths = ['/server.js', '/package.json', '/package-lock.json', '/procfile', '/.env', '/.gitignore'];
  const lowerPath = req.path.toLowerCase();
  if (blockedPaths.includes(lowerPath) || lowerPath.startsWith('/node_modules') || lowerPath.startsWith('/.git')) {
    return res.status(403).type('text/plain').send('Access denied');
  }
  next();
});

// Serve frontend assets cleanly
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  index: false
}));

// Optional MongoDB Connection (Graceful fallback if MongoDB is not running or not provided)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agnidrishti';
let mongoConnected = false;

// Handle connection events for deployment resilience
mongoose.connection.on('error', (err) => {
  mongoConnected = false;
  console.warn('MongoDB connection issue:', err.message);
});

mongoose.connection.on('disconnected', () => {
  mongoConnected = false;
  console.log('MongoDB disconnected, falling back to in-memory store.');
});

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 })
  .then(() => {
    mongoConnected = true;
    console.log('Connected to MongoDB (agnidrishti)');
  })
  .catch(() => {
    console.log('MongoDB not detected locally/remotely — running with built-in memory store for live demo.');
  });

// Mongoose Schema (FIX: default: undefined on zoneBounds so null isn't turned into [])
const CaseSchema = new mongoose.Schema({
  id: String,
  village: String,
  coords: [Number],
  zoneBounds: { type: [[Number]], default: undefined },
  fieldPoly: [[Number]],
  insatSpike: String,
  sentinelScar: String,
  ruleDecision: String,
  badgeClass: String,
  polyColor: String,
  afterPatchClass: String,
  burntArea: String,
  confidence: String,
  status: String,
  beforeLabel: String,
  afterLabel: String
});

const CaseModel = mongoose.model('EvidenceCase', CaseSchema);

// Seed Data Matching AgniDrishti Two-Signal Confidence Rules
let memoryCases = [
  {
    id: "AD-2026-01",
    village: "Dirba Block, Sangrur",
    coords: [30.255, 75.830],
    zoneBounds: [[30.240, 75.810], [30.270, 75.850]],
    fieldPoly: [[30.253, 75.828], [30.253, 75.833], [30.257, 75.833], [30.257, 75.828]],
    insatSpike: "Heat spike at 17:30 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "Scar detected on 10 m before/after field photo",
    ruleDecision: "Confirmed burning",
    badgeClass: "badge-confirmed",
    polyColor: "#dc2626",
    afterPatchClass: "patch-burnt",
    burntArea: "2.8 Acres",
    confidence: "89% (Heat spike + burn scar agree)",
    status: "Pending Officer Field Check",
    beforeLabel: "Before: Unburnt Field (10 m)",
    afterLabel: "After: Burnt Field Scar (10 m)"
  },
  {
    id: "AD-2026-02",
    village: "Sunam East, Sangrur",
    coords: [30.225, 75.875],
    zoneBounds: [[30.210, 75.855], [30.240, 75.895]],
    fieldPoly: [[30.223, 75.873], [30.223, 75.878], [30.227, 75.878], [30.227, 75.873]],
    insatSpike: "Heat spike at 18:00 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "No scar on 10 m before/after photo",
    ruleDecision: "Likely false alarm: re-check",
    badgeClass: "badge-false",
    polyColor: "#eab308",
    afterPatchClass: "patch-green",
    burntArea: "0.0 Acres",
    confidence: "24% (Mismatch: re-checked, not punished)",
    status: "Marked for Re-check (No Penalty)",
    beforeLabel: "Before: Normal Field (10 m)",
    afterLabel: "After: No Burn Scar Found"
  },
  {
    id: "AD-2026-03",
    village: "Lehra North, Sangrur",
    coords: [30.268, 75.885],
    zoneBounds: null,
    fieldPoly: [[30.266, 75.882], [30.266, 75.887], [30.270, 75.887], [30.270, 75.882]],
    insatSpike: "No spike recorded on ~4 km tripwire",
    sentinelScar: "Scar detected on 10 m before/after photo",
    ruleDecision: "Missed by the tripwire, caught late",
    badgeClass: "badge-late",
    polyColor: "#0ea5e9",
    afterPatchClass: "patch-burnt",
    burntArea: "1.4 Acres",
    confidence: "75% (CEEW burn-scar accuracy benchmark)",
    status: "Pending Officer Field Check",
    beforeLabel: "Before: Harvested Field (10 m)",
    afterLabel: "After: Burnt Field Scar (10 m)"
  },
  {
    id: "AD-2026-04",
    village: "Dhuri South, Sangrur",
    coords: [30.215, 75.815],
    zoneBounds: [[30.200, 75.795], [30.230, 75.835]],
    fieldPoly: [[30.213, 75.812], [30.213, 75.818], [30.217, 75.818], [30.217, 75.812]],
    insatSpike: "Heat spike at 19:00 IST (INSAT-3DS 30-min scan)",
    sentinelScar: "Haze or cloud blocked optical imagery",
    ruleDecision: "Re-check next clear pass",
    badgeClass: "badge-haze",
    polyColor: "#a855f7",
    afterPatchClass: "patch-haze",
    burntArea: "Pending Clear Pass",
    confidence: "Queued (Never silently dropped)",
    status: "Marked 're-check next clear pass'",
    beforeLabel: "Before: Clear Field Photo",
    afterLabel: "After: Blocked by Haze/Cloud"
  }
];

// Cloud Deployment Health Check Endpoint (AWS, Render, Railway, Kubernetes, Docker)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    database: mongoConnected ? 'mongodb' : 'in-memory',
    timestamp: new Date().toISOString()
  });
});

// GET all evidence packs with try/catch safety
app.get('/api/cases', async (req, res) => {
  try {
    if (mongoConnected) {
      const count = await CaseModel.countDocuments();
      if (count === 0) await CaseModel.insertMany(memoryCases);
      const dbCases = await CaseModel.find().lean();
      return res.json(dbCases);
    }
  } catch (err) {
    console.error('Database read error, falling back to memory store:', err.message);
  }
  res.json(memoryCases);
});

// POST human verification update from Officer with try/catch safety
app.post('/api/verify', async (req, res) => {
  const { id, status } = req.body || {};
  if (!id || !status) {
    return res.status(400).json({ error: 'Missing required fields: id and status' });
  }

  try {
    if (mongoConnected) {
      await CaseModel.updateOne({ id }, { $set: { status } });
    }
  } catch (err) {
    console.error('Database update error, updating in-memory store:', err.message);
  }
  memoryCases = memoryCases.map(c => (c.id === id ? { ...c, status } : c));
  res.json({ success: true, id, status });
});

// Serve Frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all 404 for undefined routes
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`AgniDrishti Server running at http://localhost:${PORT}`);
});

// Graceful shutdown handling for container and PaaS platforms
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});