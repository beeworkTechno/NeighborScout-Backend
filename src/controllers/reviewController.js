const Review = require('../models/Review');
const Business = require('../models/Business');

// @desc    Get reviews for a business
// @route   GET /api/reviews/:businessId
// @access  Public
const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ business: req.params.businessId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a review
// @route   POST /api/reviews/:businessId
// @access  Private
const createReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const businessId = req.params.businessId;

    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    // Check if user already reviewed this business
    const existing = await Review.findOne({ business: businessId, user: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this business' });
    }

    const review = await Review.create({
      business: businessId,
      user: req.user._id,
      rating,
      comment,
    });

    const populated = await review.populate('user', 'name avatar');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private (review owner only)
const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    const { rating, comment } = req.body;
    review.rating = rating ?? review.rating;
    review.comment = comment ?? review.comment;
    await review.save();

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (review owner only)
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    await Review.findOneAndDelete({ _id: req.params.id });
    res.json({ message: 'Review removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getReviews, createReview, updateReview, deleteReview };
