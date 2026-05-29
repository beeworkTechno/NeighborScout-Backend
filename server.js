const express = require('express');
const cors = require('cors');
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

// Serve uploaded images publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});