const express = require('express');
const router = express.Router();

const {
  getReviews,
  createReview,
  updateReview,
  getReviewImage,
  deleteReview,
} = require('../controllers/reviewController');

const { protect } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const upload = require('../middleware/upload');

router
  .route('/:businessId')
  .get(optionalAuth, getReviews)
  .post(protect, upload.array('images', 5), createReview);

router.route('/:id/images/:imageIndex').get(getReviewImage);

router
  .route('/:id')
  .put(protect, upload.array('images', 5), updateReview)
  .delete(protect, deleteReview);

module.exports = router;