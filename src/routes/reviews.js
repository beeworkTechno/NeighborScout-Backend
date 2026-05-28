const express = require('express');
const router = express.Router();

const {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');

const { protect } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');

router
  .route('/:businessId')
  .get(optionalAuth, getReviews)
  .post(protect, createReview);

router
  .route('/:id')
  .put(protect, updateReview)
  .delete(protect, deleteReview);

module.exports = router;