const express = require('express');
const router = express.Router();
const {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.route('/:businessId').get(getReviews).post(protect, createReview);
router.route('/:id').put(protect, updateReview).delete(protect, deleteReview);

module.exports = router;