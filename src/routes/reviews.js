const express = require("express");
const router = express.Router();

const {
  getReviews,
  createReview,
  updateReview,
  reactToReview,
  reportReview,
  getReportedReviews,
  verifyReviewReport,
  getReviewImage,
  deleteReview,
} = require("../controllers/reviewController");

const { protect } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const upload = require("../middleware/upload");

// Super admin report routes must stay above "/:businessId"
router.route("/admin/reports").get(protect, getReportedReviews);

router
  .route("/admin/reports/:reviewId/:reportId")
  .put(protect, verifyReviewReport);

// Public/user review routes
router
  .route("/:businessId")
  .get(optionalAuth, getReviews)
  .post(protect, upload.array("images", 5), createReview);

router.route("/:id/reaction").put(protect, reactToReview);

router.route("/:id/report").post(protect, reportReview);

router.route("/:id/images/:imageIndex").get(getReviewImage);

router
  .route("/:id")
  .put(protect, upload.array("images", 5), updateReview)
  .delete(protect, deleteReview);

module.exports = router;