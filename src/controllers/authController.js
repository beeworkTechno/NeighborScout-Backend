const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// Google OAuth Client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT
const generateToken = (id, role) => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error(
      'Missing JWT_SECRET environment variable. Add it to your .env file or environment settings.'
    );
  }

  return jwt.sign(
    { id, role },
    jwtSecret,
    { expiresIn: '30d' }
  );
};

// Format express-validator errors
const getValidationMessage = (errors) => {
  if (!errors.isEmpty()) {
    return errors.array()[0].msg || 'Invalid input data';
  }

  return null;
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

  const {
    name,
    email,
    password,
    role = 'personal',
  } = req.body;

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
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
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
        message:
          'No account found with this email. Please register first.',
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
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.log('Login Error:', error);

    res.status(500).json({
      message:
        'Something went wrong while logging in. Please try again.',
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
        message:
          'Google login is not configured properly on the server.',
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).json({
        message:
          'Could not get email from Google account. Please try again.',
      });
    }

    const {
      sub,
      email,
      name,
      picture,
    } = payload;

    const normalizedEmail = email.trim().toLowerCase();

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      user = await User.create({
        name: name || 'Google User',
        email: normalizedEmail,
        avatar: picture,
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
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.log('Google Login Error:', error);

    res.status(500).json({
      message:
        'Google login failed. Please try again.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    avatar: req.user.avatar,
    role: req.user.role,
    googleId: req.user.googleId,
    createdAt: req.user.createdAt,
    updatedAt: req.user.updatedAt,
  });
};

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
};