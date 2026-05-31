const express = require('express');
const { body } = require('express-validator');

const {
  register,
  login,
  googleLogin,
  getMe,
  updateProfilePhoto,
  getUserProfilePhoto,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('name', 'Name is required').notEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 6 characters').isLength({
      min: 6,
    }),
    body('role')
      .optional()
      .isIn(['personal', 'business'])
      .withMessage('Role must be personal or business'),
  ],
  register
);

// Login
router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').notEmpty(),
  ],
  login
);

// Google Login
router.post('/google', googleLogin);

// Current logged-in user
router.get('/me', protect, getMe);

// Update logged-in user's profile photo
router.put(
  '/profile-photo',
  protect,
  upload.single('profilePhoto'),
  updateProfilePhoto
);

// Get any user's profile photo
// Used by frontend <Image />
router.get('/profile-photo/:userId', getUserProfilePhoto);

module.exports = router;