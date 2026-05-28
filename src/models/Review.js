const mongoose = require('mongoose');
const crypto = require('crypto');

const pseudoAdjectives = [
  'Helpful',
  'Honest',
  'Local',
  'Trusted',
  'Friendly',
  'Curious',
  'Careful',
  'Kind',
  'Bright',
  'Calm',
  'Smart',
  'Fair',
];

const pseudoNouns = [
  'Neighbor',
  'Reviewer',
  'Visitor',
  'Customer',
  'Explorer',
  'Guest',
  'Scout',
  'Resident',
  'User',
  'Friend',
];

const generatePseudoName = () => {
  const adjective =
    pseudoAdjectives[crypto.randomInt(0, pseudoAdjectives.length)];

  const noun =
    pseudoNouns[crypto.randomInt(0, pseudoNouns.length)];

  const number = crypto.randomInt(100, 9999);

  return `${adjective} ${noun} ${number}`;
};

const reviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },

    // Kept internally only.
    // Do not expose this user field to frontend responses.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },

    pseudoName: {
      type: String,
      default: generatePseudoName,
    },

    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      default: '',
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// A user can only review a business once
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
  const Business = require('./Business');

  const stats = await ReviewModel.aggregate([
    {
      $match: {
        business: businessId,
      },
    },
    {
      $group: {
        _id: '$business',
        avgRating: {
          $avg: '$rating',
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  await Business.findByIdAndUpdate(businessId, {
    averageRating:
      stats.length > 0
        ? Math.round(stats[0].avgRating * 10) / 10
        : 0,
    reviewCount:
      stats.length > 0
        ? stats[0].count
        : 0,
  });
};

// After saving or updating a review, update business averageRating
reviewSchema.post('save', async function () {
  await updateBusinessRating(this.business, this.constructor);
});

// After deleting a review, update business averageRating
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await updateBusinessRating(doc.business, doc.constructor);
  }
});

module.exports = mongoose.model('Review', reviewSchema);