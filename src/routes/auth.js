const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  register,
  login,
  googleLogin,
  getMe,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ==========================
// Register
// ==========================
router.post(
  '/register',
  [
    body('name', 'Name is required').notEmpty(),

    body('email', 'Please include a valid email')
      .isEmail(),

    body(
      'password',
      'Password must be at least 6 characters'
    ).isLength({ min: 6 }),
  ],
  register
);

// ==========================
// Login
// ==========================
router.post(
  '/login',
  [
    body('email', 'Please include a valid email')
      .isEmail(),

    body('password', 'Password is required')
      .notEmpty(),
  ],
  login
);

// ==========================
// Google Login
// ==========================
router.post('/google', googleLogin);

// ==========================
// Current Logged In User
// ==========================
router.get('/me', protect, getMe);

module.exports = router; 