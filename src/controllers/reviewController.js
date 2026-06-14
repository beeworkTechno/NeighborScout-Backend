const Review = require("../models/Review");
const Business = require("../models/Business");
const { containsBlockedWords } = require("../utils/reviewFilter");

const MAX_REVIEW_IMAGES = 5;

const getReviewImageUrls = (review) => {
  const imageCount = Array.isArray(review.images) ? review.images.length : 0;

  return Array.from(
    { length: imageCount },
    (_, index) => `/api/reviews/${review._id}/images/${index}`
  );
};

const getUploadedReviewImages = (files = []) => {
  return files.slice(0, MAX_REVIEW_IMAGES).map((file) => ({
    data: file.buffer,
    contentType: file.mimetype,
  }));
};

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
    pseudoName: review.pseudoName || "Anonymous Neighbor",
    rating: review.rating,
    comment: review.comment,
    imageUrls: getReviewImageUrls(review),
    imageCount: Array.isArray(review.images) ? review.images.length : 0,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    canEdit: Boolean(isOwner && currentUser?.role !== "business"),
    canDelete: Boolean(isOwner && currentUser?.role !== "business"),
  };
};

const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      business: req.params.businessId,
    })
      .select("+user -images.data")
      .sort({
        createdAt: -1,
      });

    const safeReviews = reviews.map((review) =>
      formatReviewResponse(review, req.user)
    );

    res.json(safeReviews);
  } catch (error) {
    console.log("Get Reviews Error:", error);

    res.status(500).json({
      message: "Failed to load reviews.",
    });
  }
};

const createReview = async (req, res) => {
  try {
    if (req.user.role === "business") {
      return res.status(403).json({
        message: "Business accounts cannot rate or review businesses.",
      });
    }

    const { rating, comment } = req.body;
    const businessId = req.params.businessId;
    const cleanComment = comment?.trim() || "";

    if (containsBlockedWords(cleanComment)) {
      return res.status(400).json({
        message:
          "Your review contains inappropriate language. Please edit it and try again.",
      });
    }

    const numericRating = Number(rating);

    if (
      Number.isNaN(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5.",
      });
    }

    const business = await Business.findById(businessId);

    if (!business) {
      return res.status(404).json({
        message: "Business not found.",
      });
    }

    const existing = await Review.findOne({
      business: businessId,
      user: req.user._id,
    }).select("+user -images.data");

    if (existing) {
      return res.status(400).json({
        message: "You have already reviewed this business.",
      });
    }

    const review = await Review.create({
      business: businessId,
      user: req.user._id,
      rating: numericRating,
      comment: cleanComment,
      images: getUploadedReviewImages(req.files),
    });

    const fullReview = await Review.findById(review._id).select(
      "+user -images.data"
    );

    res.status(201).json(formatReviewResponse(fullReview, req.user));
  } catch (error) {
    console.log("Create Review Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "You have already reviewed this business.",
      });
    }

    res.status(500).json({
      message: "Failed to create review.",
    });
  }
};

const updateReview = async (req, res) => {
  try {
    if (req.user.role === "business") {
      return res.status(403).json({
        message: "Business accounts cannot update reviews or ratings.",
      });
    }

    const review = await Review.findById(req.params.id).select(
      "+user -images.data"
    );

    if (!review) {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only update your own review.",
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
          message: "Rating must be between 1 and 5.",
        });
      }

      review.rating = numericRating;
    }

    if (comment !== undefined) {
      const cleanComment = comment.trim();

      if (containsBlockedWords(cleanComment)) {
        return res.status(400).json({
          message:
            "Your review contains inappropriate language. Please edit it and try again.",
        });
      }

      review.comment = cleanComment;
    }

    if (req.body.removeImages === "true") {
      review.images = [];
    }

    if (req.files && req.files.length > 0) {
      review.images = getUploadedReviewImages(req.files);
    }

    await review.save();

    const updatedReview = await Review.findById(review._id).select(
      "+user -images.data"
    );

    res.json(formatReviewResponse(updatedReview, req.user));
  } catch (error) {
    console.log("Update Review Error:", error);

    res.status(500).json({
      message: "Failed to update review.",
    });
  }
};

const getReviewImage = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).select("images");
    const imageIndex = Number(req.params.imageIndex);

    if (
      !review ||
      Number.isNaN(imageIndex) ||
      imageIndex < 0 ||
      !review.images ||
      !review.images[imageIndex] ||
      !review.images[imageIndex].data
    ) {
      return res.status(404).json({
        message: "Review image not found.",
      });
    }

    const image = review.images[imageIndex];

    res.set("Content-Type", image.contentType || "image/jpeg");
    res.send(image.data);
  } catch (error) {
    console.log("Get Review Image Error:", error);

    res.status(500).json({
      message: "Failed to load review image.",
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    if (req.user.role === "business") {
      return res.status(403).json({
        message: "Business accounts cannot delete reviews or ratings.",
      });
    }

    const review = await Review.findById(req.params.id).select(
      "+user -images.data"
    );

    if (!review) {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only delete your own review.",
      });
    }

    await Review.findOneAndDelete({
      _id: req.params.id,
    });

    res.json({
      message: "Review removed.",
    });
  } catch (error) {
    console.log("Delete Review Error:", error);

    res.status(500).json({
      message: "Failed to delete review.",
    });
  }
};

module.exports = {
  getReviews,
  createReview,
  updateReview,
  getReviewImage,
  deleteReview,
};