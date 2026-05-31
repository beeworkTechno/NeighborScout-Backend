const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';

const generateToken = (id, role) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      'Missing JWT_SECRET environment variable. Add it to your .env file or environment settings.'
    );
  }

  return jwt.sign({ id, role }, jwtSecret, { expiresIn: '30d' });
};

const getValidationMessage = (errors) => {
  if (!errors.isEmpty()) {
    return errors.array()[0].msg || 'Invalid input data';
  }

  return null;
};

const userHasProfilePhoto = (user) => {
  return Boolean(
    user &&
      user.profilePhoto &&
      user.profilePhoto.data &&
      user.profilePhoto.contentType
  );
};

const getUserProfilePhotoUrl = (user) => {
  if (!userHasProfilePhoto(user) || !user?._id) {
    return '';
  }

  return `${API_BASE_URL}/auth/profile-photo/${user._id}`;
};

const formatUserResponse = (user) => {
  const hasProfilePhoto = userHasProfilePhoto(user);

  return {
    _id: user._id,
    name: user.name,
    email: user.email,

    // Google avatar URL can still exist, but uploaded MongoDB photo has priority on frontend.
    avatar: user.avatar,

    role: user.role,
    googleId: user.googleId,

    hasProfilePhoto,
    profilePhotoUrl: hasProfilePhoto ? getUserProfilePhotoUrl(user) : '',

    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const errors = validationResult(req);
  const validationMessage = getValidationMessage(errors);

  if (validationMessage) {
    return res.status(400).json({
      message: validationMessage,
      errors: errors.array(),
    });
  }

  const { name, email, password, role = 'personal' } = req.body;

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({
      email: normalizedEmail,
    });

    if (userExists) {
      if (userExists.googleId && !userExists.password) {
        return res.status(400).json({
          message:
            'This email is already registered with Google. Please use Continue with Google to login.',
        });
      }

      return res.status(400).json({
        message:
          'An account with this email already exists. Please login instead.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    });

    res.status(201).json({
      ...formatUserResponse(user),
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.log('Register Error:', error);

    res.status(500).json({
      message:
        'Something went wrong while creating your account. Please try again.',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const errors = validationResult(req);
  const validationMessage = getValidationMessage(errors);

  if (validationMessage) {
    return res.status(400).json({
      message: validationMessage,
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(404).json({
        message: 'No account found with this email. Please register first.',
      });
    }

    if (user.googleId && !user.password) {
      return res.status(401).json({
        message:
          'This account was created with Google. Please use Continue with Google to login.',
      });
    }

    const isPasswordCorrect = await user.matchPassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: 'Incorrect password. Please try again.',
      });
    }

    res.json({
      ...formatUserResponse(user),
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.log('Login Error:', error);

    res.status(500).json({
      message: 'Something went wrong while logging in. Please try again.',
    });
  }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'Google token missing. Please try again.',
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        message: 'Google login is not configured properly on the server.',
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({
        message: 'Could not get email from Google account. Please try again.',
      });
    }

    const { sub, email, name, picture } = payload;
    const normalizedEmail = email.trim().toLowerCase();

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      user = await User.create({
        name: name || 'Google User',
        email: normalizedEmail,
        avatar: picture || '',
        googleId: sub,
        password: '',
        role: 'personal',
      });
    }

    if (user && !user.googleId) {
      user.googleId = sub;

      if (!user.avatar && picture) {
        user.avatar = picture;
      }

      await user.save();
    }

    res.json({
      ...formatUserResponse(user),
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.log('Google Login Error:', error);

    res.status(500).json({
      message: 'Google login failed. Please try again.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.json(formatUserResponse(req.user));
};

// @desc    Update logged-in user's profile photo
// @route   PUT /api/auth/profile-photo
// @access  Private
const updateProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Please upload an image.',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    user.profilePhoto = {
      data: req.file.buffer,
      contentType: req.file.mimetype,
    };

    await user.save();

    res.json({
      message: 'Profile photo updated successfully.',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.log('Update Profile Photo Error:', error);

    res.status(500).json({
      message: error.message || 'Failed to update profile photo.',
    });
  }
};

// @desc    Get user profile photo from MongoDB
// @route   GET /api/auth/profile-photo/:userId
// @access  Public
const getUserProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('profilePhoto');

    if (!user || !user.profilePhoto?.data) {
      return res.status(404).json({
        message: 'Profile photo not found.',
      });
    }

    res.set('Content-Type', user.profilePhoto.contentType || 'image/jpeg');
    res.send(user.profilePhoto.data);
  } catch (error) {
    console.log('Get User Profile Photo Error:', error);

    res.status(500).json({
      message: 'Failed to load profile photo.',
    });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  updateProfilePhoto,
  getUserProfilePhoto,
};