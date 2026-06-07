const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectDB = require('./src/config/db');

if (!process.env.JWT_SECRET) {
  console.error(
    'Error: Missing JWT_SECRET environment variable. Add it to your .env file or environment settings.'
  );
  process.exit(1);
}

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'NeighborScout API running 🚀',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'NeighborScout backend is healthy',
  });
});

// Share endpoints
const SHARE_BASE_URL = process.env.SHARE_BASE_URL || 'https://neighborscout-backend.onrender.com';
const SHARE_TEMPLATE_PATH = path.join(__dirname, 'shareTemplate.html');

app.get('/api/share/business/:businessId', (req, res) => {
  const { businessId } = req.params;
  const { name, address, lat, lng } = req.query;

  if (!businessId) return res.status(400).json({ error: 'Missing businessId.' });

  const baseUrl = process.env.SHARE_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const queryParams = new URLSearchParams();
  if (name) queryParams.set('name', name);
  if (address) queryParams.set('address', address);
  if (lat) queryParams.set('lat', lat);
  if (lng) queryParams.set('lng', lng);

  const shareUrl =
    `${baseUrl}/share/business/${encodeURIComponent(businessId)}` +
    (queryParams.toString() ? `?${queryParams.toString()}` : '');

  res.json({ shareUrl });
});
console.log("✅ Registering /share/business route");

app.get('/share/business/:businessId', (req, res) => {
    console.log("✅ Share route was hit");
  const { businessId } = req.params;
  const { name, address, lat, lng } = req.query;

  if (!businessId) return res.status(400).send('Missing business ID.');

  let html = fs.readFileSync(SHARE_TEMPLATE_PATH, 'utf8');
  const appDeepLink = `neighborscout://business/${encodeURIComponent(businessId)}`;
  const mapsUrl =
    lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`
      : 'https://www.google.com/maps';

  html = html.replace(/%BUSINESS_NAME%/g, name || 'Shared business');
  html = html.replace(/%BUSINESS_ADDRESS%/g, address || 'Address not available');
  html = html.replace(/%LATITUDE%/g, lat || '');
  html = html.replace(/%LONGITUDE%/g, lng || '');
  html = html.replace(/%GOOGLE_MAPS_URL%/g, mapsUrl);
  html = html.replace(/%APP_DEEP_LINK%/g, appDeepLink);

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/businesses', require('./src/routes/businesses'));
app.use('/api/reviews', require('./src/routes/reviews'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/api/health`);
});