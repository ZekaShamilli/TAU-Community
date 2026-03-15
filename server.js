const express = require('express');
const path = require('path');
const apiHandler = require('./api/index.js');
const checkApplicationHandler = require('./api/check-application.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// API Routes - Check application endpoint (must come first)
app.all('/api/applications/check', async (req, res) => {
  await checkApplicationHandler(req, res);
});

// API Routes - All other API endpoints
app.all('/api/*', async (req, res) => {
  await apiHandler(req, res);
});

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, 'packages/frontend/dist')));

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'packages/frontend/dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
});
