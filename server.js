const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./src/config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/businesses', require('./src/routes/businesses'));
app.use('/api/reviews', require('./src/routes/reviews'));

// Health check
app.get('/', (req, res) => res.json({ message: 'Neighbor API running 🚀' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
