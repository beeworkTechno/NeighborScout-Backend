const Review = require("../models/Review");
const Business = require("../models/Business");
const { containsBlockedWords } = require("../utils/reviewFilter");

const MAX_REVIEW_IMAGES = 5;

const SUPER_ADMIN_ROLES = ["superadmin", "super-admin", "super_admin"];

const isSuperAdmin = (user) => {
  return Boolean(user && SUPER_ADMIN_ROLES.includes(user.role));
};

const getReviewOwnerRole = (review) => {
  if (review.user && typeof review.user === "object" && review.user.role) {
    return review.user.role;
  }

  return null;
};

const getReportUserId = (report) => {
  return report.user?._id
    ? report.user._id.toString()
    : report.user?.toString();
};

const getReviewUserId = (review) => {
  if (review.user?._id) {
    return review.user._id.toString();
  }

  if (review.user) {
    return review.user.toString();
  }

  return null;
};

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

const getUserReaction = (review, currentUser = null) => {
  const currentUserId = currentUser?._id?.toString();

  if (!currentUserId) {
    return null;
  }

  const likedBy = Array.isArray(review.likedBy) ? review.likedBy : [];
  const dislikedBy = Array.isArray(review.dislikedBy)
    ? review.dislikedBy
    : [];

  const hasLiked = likedBy.some((userId) => {
    return userId.toString() === currentUserId;
  });

  const hasDisliked = dislikedBy.some((userId) => {
    return userId.toString() === currentUserId;
  });

  if (hasLiked) return "like";
  if (hasDisliked) return "dislike";

  return null;
};

const formatReviewResponse = (review, currentUser = null) => {
  const reviewUserId = getReviewUserId(review);
  const currentUserId = currentUser?._id?.toString();

  const isOwner =
    reviewUserId && currentUserId && reviewUserId === currentUserId;

  const likedBy = Array.isArray(review.likedBy) ? review.likedBy : [];
  const dislikedBy = Array.isArray(review.dislikedBy)
    ? review.dislikedBy
    : [];
  const reports = Array.isArray(review.reports) ? review.reports : [];

  const reviewOwnerRole = getReviewOwnerRole(review);

  const hasReported = reports.some((report) => {
    return getReportUserId(report) === currentUserId;
  });

  return {
    _id: review._id,
    business: review.business,
    pseudoName: review.pseudoName || "Anonymous Neighbor",
    rating: review.rating,
    comment: review.comment,
    imageUrls: getReviewImageUrls(review),
    imageCount: Array.isArray(review.images) ? review.images.length : 0,

    likeCount: likedBy.length,
    dislikeCount: dislikedBy.length,
    myReaction: getUserReaction(review, currentUser),

    reportedByMe: hasReported,

    createdAt: review.createdAt,
    updatedAt: review.updatedAt,

    canEdit: Boolean(isOwner && currentUser?.role !== "business"),
    canDelete: Boolean(isOwner && currentUser?.role !== "business"),

    canReact: Boolean(
      currentUser &&
        currentUser.role === "personal" &&
        reviewOwnerRole === "personal" &&
        reviewUserId &&
        currentUserId &&
        reviewUserId !== currentUserId
    ),

    canReport: Boolean(
      currentUser &&
        currentUser.role === "personal" &&
        reviewOwnerRole === "personal" &&
        reviewUserId &&
        currentUserId &&
        reviewUserId !== currentUserId &&
        !hasReported
    ),
  };
};

const getReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      business: req.params.businessId,
      moderationStatus: {
        $ne: "hidden",
      },
    })
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role")
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
      likedBy: [],
      dislikedBy: [],
      reports: [],
      moderationStatus: "active",
    });

    const fullReview = await Review.findById(review._id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

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
      "+user +likedBy +dislikedBy +reports -images.data"
    );

    if (!review || review.moderationStatus === "hidden") {
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

    const updatedReview = await Review.findById(review._id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

    res.json(formatReviewResponse(updatedReview, req.user));
  } catch (error) {
    console.log("Update Review Error:", error);

    res.status(500).json({
      message: "Failed to update review.",
    });
  }
};

const reactToReview = async (req, res) => {
  try {
    if (req.user.role !== "personal") {
      return res.status(403).json({
        message: "Only personal users can like or dislike reviews.",
      });
    }

    const { reaction } = req.body;

    if (!["like", "dislike", "none"].includes(reaction)) {
      return res.status(400).json({
        message: "Reaction must be like, dislike, or none.",
      });
    }

    const review = await Review.findById(req.params.id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

    if (!review || review.moderationStatus === "hidden") {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    const reviewOwnerId = getReviewUserId(review);
    const currentUserId = req.user._id.toString();

    if (reviewOwnerId === currentUserId) {
      return res.status(403).json({
        message: "You cannot like or dislike your own review.",
      });
    }

    if (review.user?.role !== "personal") {
      return res.status(403).json({
        message: "You can only react to reviews posted by personal users.",
      });
    }

    review.likedBy = review.likedBy || [];
    review.dislikedBy = review.dislikedBy || [];

    const alreadyLiked = review.likedBy.some((userId) => {
      return userId.toString() === currentUserId;
    });

    const alreadyDisliked = review.dislikedBy.some((userId) => {
      return userId.toString() === currentUserId;
    });

    review.likedBy = review.likedBy.filter((userId) => {
      return userId.toString() !== currentUserId;
    });

    review.dislikedBy = review.dislikedBy.filter((userId) => {
      return userId.toString() !== currentUserId;
    });

    if (reaction === "like" && !alreadyLiked) {
      review.likedBy.push(req.user._id);
    }

    if (reaction === "dislike" && !alreadyDisliked) {
      review.dislikedBy.push(req.user._id);
    }

    await review.save();

    const updatedReview = await Review.findById(review._id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

    res.json(formatReviewResponse(updatedReview, req.user));
  } catch (error) {
    console.log("React To Review Error:", error);

    res.status(500).json({
      message: "Failed to update review reaction.",
    });
  }
};

const reportReview = async (req, res) => {
  try {
    if (req.user.role !== "personal") {
      return res.status(403).json({
        message: "Only personal users can report reviews.",
      });
    }

    const allowedReasons = [
      "inappropriate",
      "spam",
      "harassment",
      "false_information",
      "other",
    ];

    const reason = allowedReasons.includes(req.body.reason)
      ? req.body.reason
      : "inappropriate";

    const details = req.body.details?.trim() || "";

    if (details.length > 500) {
      return res.status(400).json({
        message: "Report details must be 500 characters or less.",
      });
    }

    const review = await Review.findById(req.params.id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

    if (!review || review.moderationStatus === "hidden") {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    const reviewOwnerId = getReviewUserId(review);
    const currentUserId = req.user._id.toString();

    if (reviewOwnerId === currentUserId) {
      return res.status(403).json({
        message: "You cannot report your own review.",
      });
    }

    if (review.user?.role !== "personal") {
      return res.status(403).json({
        message: "You can only report reviews posted by personal users.",
      });
    }

    review.reports = review.reports || [];

    const alreadyReported = review.reports.some((report) => {
      return getReportUserId(report) === currentUserId;
    });

    if (alreadyReported) {
      return res.status(400).json({
        message: "You have already reported this review.",
      });
    }

    review.reports.push({
      user: req.user._id,
      reason,
      details,
      status: "pending",
    });

    await review.save();

    const updatedReview = await Review.findById(review._id)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "role");

    res.json({
      message: "Review reported successfully. A super admin will verify it.",
      review: formatReviewResponse(updatedReview, req.user),
    });
  } catch (error) {
    console.log("Report Review Error:", error);

    res.status(500).json({
      message: "Failed to report review.",
    });
  }
};

const getReportedReviews = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({
        message: "Only super admins can view reported reviews.",
      });
    }

    const status = req.query.status || "pending";

    let query;

    if (status === "all") {
      query = {
        "reports.0": {
          $exists: true,
        },
      };
    } else {
      query = {
        reports: {
          $elemMatch: {
            status,
          },
        },
      };
    }

    const reviews = await Review.find(query)
      .select("+user +likedBy +dislikedBy +reports -images.data")
      .populate("user", "name email role")
      .populate("business", "name category address")
      .sort({
        updatedAt: -1,
      });

    const results = reviews.map((review) => ({
      _id: review._id,
      business: review.business,
      reviewUser: review.user,
      pseudoName: review.pseudoName || "Anonymous Neighbor",
      rating: review.rating,
      comment: review.comment,
      imageUrls: getReviewImageUrls(review),
      imageCount: Array.isArray(review.images) ? review.images.length : 0,
      likeCount: review.likedBy?.length || 0,
      dislikeCount: review.dislikedBy?.length || 0,
      moderationStatus: review.moderationStatus,
      hiddenReason: review.hiddenReason,
      hiddenBy: review.hiddenBy,
      hiddenAt: review.hiddenAt,
      reports: review.reports,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    res.json(results);
  } catch (error) {
    console.log("Get Reported Reviews Error:", error);

    res.status(500).json({
      message: "Failed to load reported reviews.",
    });
  }
};

const verifyReviewReport = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({
        message: "Only super admins can verify reported reviews.",
      });
    }

    const { reviewId, reportId } = req.params;
    const { action, adminNote } = req.body;

    const allowedActions = [
      "verify",
      "dismiss",
      "reject_review",
      "hide_review",
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        message:
          "Action must be verify, dismiss, reject_review, or hide_review.",
      });
    }

    const review = await Review.findById(reviewId).select(
      "+user +likedBy +dislikedBy +reports -images.data"
    );

    if (!review) {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    const report = review.reports.id(reportId);

    if (!report) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    report.adminNote = adminNote?.trim() || "";
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    if (action === "dismiss") {
      report.status = "dismissed";

      await review.save();

      return res.json({
        message: "Report dismissed. Review remains public.",
      });
    }

    if (action === "verify") {
      report.status = "verified";

      await review.save();

      return res.json({
        message: "Report verified. Review remains public until rejected.",
      });
    }

    if (action === "reject_review" || action === "hide_review") {
      report.status = "verified";

      review.moderationStatus = "hidden";
      review.hiddenReason =
        adminNote?.trim() || "Review rejected by super admin.";
      review.hiddenBy = req.user._id;
      review.hiddenAt = new Date();

      await review.save();

      return res.json({
        message:
          "Report verified and review rejected. Review is hidden from public but kept in database.",
      });
    }
  } catch (error) {
    console.log("Verify Review Report Error:", error);

    res.status(500).json({
      message: "Failed to verify report.",
    });
  }
};

const getReviewImage = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).select(
      "images moderationStatus"
    );

    const imageIndex = Number(req.params.imageIndex);

    if (
      !review ||
      review.moderationStatus === "hidden" ||
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
      "+user +likedBy +dislikedBy +reports -images.data"
    );

    if (!review) {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    if (review.moderationStatus === "hidden") {
      return res.status(403).json({
        message:
          "This review has been hidden after moderation and cannot be deleted by the user.",
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
  reactToReview,
  reportReview,
  getReportedReviews,
  verifyReviewReport,
  getReviewImage,
  deleteReview,
};