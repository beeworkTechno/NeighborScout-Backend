const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectDB = require('./src/config/db');
const Business = require('./src/models/Business');

if (!process.env.JWT_SECRET) {
  console.error(
    'Error: Missing JWT_SECRET environment variable. Add it to your .env file or environment settings.'
  );
  process.exit(1);
}

const app = express();

// Initialize app with async database connection
const initializeApp = async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB connected, setting up routes...');

    app.use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

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

    // Test endpoints
    app.get('/api/version', (req, res) => {
      res.json({ 
        version: '2.0 - Deep linking enabled',
        timestamp: new Date().toISOString()
      });
    });

    app.get('/test', (req, res) => {
      res.json({ message: 'Phone can reach computer!', yourIP: req.ip });
    });

    const SHARE_BASE_URL = process.env.SHARE_BASE_URL || 'https://neighborscout-backend.onrender.com';

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

    // Main share route - redirects to frontend web app
    app.get('/share/business/:businessId', async (req, res) => {
      const { businessId } = req.params;
      
      console.log('Looking for business with ID:', businessId);

      if (!businessId) {
        return res.status(400).send('Missing business ID.');
      }

      try {
        const business = await Business.findById(businessId);
        
        if (!business) {
          console.log('Business not found in database');
          return res.status(404).send('Business not found.');
        }

        // Get the frontend URL from env
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
        
        // For web browsers - redirect directly to the frontend business page
        const userAgent = req.headers['user-agent'] || '';
        const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
        
        if (!isMobile) {
          // Desktop web - redirect to frontend
          const redirectUrl = `${frontendUrl}/business/${businessId}`;
          console.log('Redirecting desktop web to:', redirectUrl);
          return res.redirect(redirectUrl);
        }
        
        // For mobile - show page that can open the app or continue in browser
        const deepLink = `neighborscout://business/${encodeURIComponent(businessId)}`;
        const webUrl = `${frontendUrl}/business/${businessId}`;
        
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${business.name} - NeighborScout</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                margin: 0;
                padding: 0;
                background: #f7f7f7;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
              }
              .card {
                background: white;
                border-radius: 20px;
                padding: 30px;
                margin-top: 50px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .business-name {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0 10px;
                color: #333;
              }
              .business-address {
                color: #666;
                margin-bottom: 30px;
              }
              .button {
                display: inline-block;
                background: #F9B208;
                color: #fff;
                padding: 14px 28px;
                border-radius: 16px;
                text-decoration: none;
                font-weight: bold;
                margin: 10px;
                border: none;
                cursor: pointer;
                font-size: 16px;
              }
              .button-secondary {
                background: #666;
              }
              .message {
                margin-top: 20px;
                font-size: 14px;
                color: #999;
              }
              .spinner {
                display: none;
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #F9B208;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="business-name">${business.name}</div>
                <div class="business-address">${business.address || 'Address not available'}</div>
                <button id="openAppBtn" class="button">Open in App</button>
                <button id="continueWebBtn" class="button button-secondary">Continue in Browser</button>
                <div id="spinner" class="spinner"></div>
                <p class="message">
                  Don't have the app?<br>
                  <a href="#" id="downloadLink" style="color: #F9B208;">Download NeighborScout</a>
                </p>
              </div>
            </div>
            <script>
              const deepLink = '${deepLink}';
              const webUrl = '${webUrl}';
              
              document.getElementById('openAppBtn').onclick = function() {
                document.getElementById('spinner').style.display = 'block';
                document.getElementById('openAppBtn').style.display = 'none';
                document.getElementById('continueWebBtn').style.display = 'none';
                
                // Try to open the app
                window.location.href = deepLink;
                
                // If app doesn't open after 2 seconds, show buttons again
                setTimeout(() => {
                  document.getElementById('spinner').style.display = 'none';
                  document.getElementById('openAppBtn').style.display = 'inline-block';
                  document.getElementById('continueWebBtn').style.display = 'inline-block';
                }, 2000);
              };
              
              document.getElementById('continueWebBtn').onclick = function() {
                window.location.href = webUrl;
              };
              
              document.getElementById('downloadLink').onclick = function(e) {
                e.preventDefault();
                window.location.href = webUrl;
              };
            </script>
          </body>
          </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
        
      } catch (error) {
        console.error('Share route error:', error);
        res.status(500).send('Error loading business share page.');
      }
    });

    app.use('/api/auth', require('./src/routes/auth'));
    app.use('/api/businesses', require('./src/routes/businesses'));
    app.use('/api/reviews', require('./src/routes/reviews'));

    app.use((req, res) => {
      res.status(404).json({
        message: `Route not found: ${req.method} ${req.originalUrl}`,
      });
    });

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
      console.log(`Version: http://localhost:${PORT}/api/version`);
      console.log(`Test:    http://localhost:${PORT}/test`);
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    process.exit(1);
  }
};

// Start the application
initializeApp();