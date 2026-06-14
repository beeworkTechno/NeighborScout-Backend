const mongoose = require("mongoose");
const crypto = require("crypto");

const pseudoAdjectives = [
  "Helpful",
  "Honest",
  "Local",
  "Trusted",
  "Friendly",
  "Careful",
  "Kind",
  "Bright",
  "Fair",
  "Calm",
  "Curious",
  "Reliable",
];

const pseudoNouns = [
  "Neighbor",
  "Reviewer",
  "Customer",
  "Visitor",
  "Explorer",
  "Scout",
  "Resident",
  "Guest",
  "User",
  "Friend",
];

const generatePseudoName = () => {
  const adjective =
    pseudoAdjectives[crypto.randomInt(0, pseudoAdjectives.length)];

  const noun = pseudoNouns[crypto.randomInt(0, pseudoNouns.length)];

  const number = crypto.randomInt(100, 9999);

  return `${adjective} ${noun} ${number}`;
};

const reviewReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "inappropriate",
        "spam",
        "harassment",
        "false_information",
        "other",
      ],
      default: "inappropriate",
    },

    details: {
      type: String,
      default: "",
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "dismissed"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

const reviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      select: false,
    },

    pseudoName: {
      type: String,
      default: generatePseudoName,
    },

    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    images: [
      {
        data: Buffer,
        contentType: String,
      },
    ],

    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        select: false,
      },
    ],

    dislikedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        select: false,
      },
    ],

    reports: {
      type: [reviewReportSchema],
      default: [],
      select: false,
    },

    moderationStatus: {
      type: String,
      enum: ["active", "hidden"],
      default: "active",
    },

    hiddenReason: {
      type: String,
      default: "",
    },

    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    hiddenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index(
  {
    business: 1,
    user: 1,
  },
  {
    unique: true,
  }
);

const updateBusinessRating = async (businessId, ReviewModel) => {
  const Business = require("./Business");

  const stats = await ReviewModel.aggregate([
    {
      $match: {
        business: businessId,
        moderationStatus: {
          $ne: "hidden",
        },
      },
    },
    {
      $group: {
        _id: "$business",
        avgRating: {
          $avg: "$rating",
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  await Business.findByIdAndUpdate(businessId, {
    averageRating:
      stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0,
    reviewCount: stats.length > 0 ? stats[0].count : 0,
  });
};

reviewSchema.post("save", async function () {
  await updateBusinessRating(this.business, this.constructor);
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await updateBusinessRating(doc.business, doc.constructor);
  }
});

module.exports = mongoose.model("Review", reviewSchema);