const Review = require('../models/Review');
const Business = require('../models/Business');

const formatReviewResponse = (review, currentUser = null) => {
  const reviewUserId = review.user?._id
    ? review.user._id.toString()
    : review.user?.toString();

  const currentUserId = currentUser?._id?.toString();

  const isOwner =
    reviewUserId && currentUserId && reviewUserId === currentUserId;

  return {
    _id: review._id,
    business: review.business,
    pseudoName: review.pseudoName || 'Anonymous Neighbor',
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,

    // Safe frontend permissions.
    // Real user identity is still not exposed.
    canEdit: Boolean(isOwner && currentUser?.role !== 'business'),
    canDelete: Boolean(isOwner && currentUser?.role !== 'business'),
  };
};

// @desc    Get reviews for a business
// @route   GET /api/reviews/:businessId
// @access  Public, with optional user permissions
const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      business: req.params.businessId,
    })
      .select('+user')
      .sort({
        createdAt: -1,
      });

    const safeReviews = reviews.map((review) =>
      formatReviewResponse(review, req.user)
    );

    res.json(safeReviews);
  } catch (error) {
    console.log('Get Reviews Error:', error);

    res.status(500).json({
      message: 'Failed to load reviews.',
    });
  }
};

// @desc    Create a review
// @route   POST /api/reviews/:businessId
// @access  Private personal users only
const createReview = async (req, res) => {
  try {
    if (req.user.role === 'business') {
      return res.status(403).json({
        message: 'Business accounts cannot rate or review businesses.',
      });
    }

    const { rating, comment } = req.body;
    const businessId = req.params.businessId;

    const numericRating = Number(rating);

    if (
      Number.isNaN(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5.',
      });
    }

    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found.',
      });
    }

    const existing = await Review.findOne({
      business: businessId,
      user: req.user._id,
    }).select('+user');

    if (existing) {
      return res.status(400).json({
        message: 'You have already reviewed this business.',
      });
    }

    const review = await Review.create({
      business: businessId,
      user: req.user._id,
      rating: numericRating,
      comment: comment?.trim() || '',
    });

    const fullReview = await Review.findById(review._id).select('+user');

    res.status(201).json(formatReviewResponse(fullReview, req.user));
  } catch (error) {
    console.log('Create Review Error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: 'You have already reviewed this business.',
      });
    }

    res.status(500).json({
      message: 'Failed to create review.',
    });
  }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
// @access  Private personal review owner only
const updateReview = async (req, res) => {
  try {
    if (req.user.role === 'business') {
      return res.status(403).json({
        message: 'Business accounts cannot update reviews or ratings.',
      });
    }

    const review = await Review.findById(req.params.id).select('+user');

    if (!review) {
      return res.status(404).json({
        message: 'Review not found.',
      });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only update your own review.',
      });
    }

    const { rating, comment } = req.body;

    if (rating !== undefined) {
      const numericRating = Number(rating);

      if (
        Number.isNaN(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          message: 'Rating must be between 1 and 5.',
        });
      }

      review.rating = numericRating;
    }

    if (comment !== undefined) {
      review.comment = comment.trim();
    }

    await review.save();

    const updatedReview = await Review.findById(review._id).select('+user');

    res.json(formatReviewResponse(updatedReview, req.user));
  } catch (error) {
    console.log('Update Review Error:', error);

    res.status(500).json({
      message: 'Failed to update review.',
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private personal review owner only
const deleteReview = async (req, res) => {
  try {
    if (req.user.role === 'business') {
      return res.status(403).json({
        message: 'Business accounts cannot delete reviews or ratings.',
      });
    }

    const review = await Review.findById(req.params.id).select('+user');

    if (!review) {
      return res.status(404).json({
        message: 'Review not found.',
      });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only delete your own review.',
      });
    }

    await Review.findOneAndDelete({
      _id: req.params.id,
    });

    res.json({
      message: 'Review removed.',
    });
  } catch (error) {
    console.log('Delete Review Error:', error);

    res.status(500).json({
      message: 'Failed to delete review.',
    });
  }
};

module.exports = {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
};