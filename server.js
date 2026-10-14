const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve the AgniDrishti Officer & Farmer Portal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Endpoint for Officer Field Verification Feedback Loop
app.post('/api/verify-case', (req, res) => {
  const { caseId, officerVerdict } = req.body;
  res.json({
    success: true,
    message: `Case ${caseId} updated by human officer: ${officerVerdict}. Ground feedback logged to improve seasonal rules.`
  });
});

app.listen(PORT, () => {
  console.log(`AgniDrishti Prototype Server running at http://localhost:${PORT}`);
});