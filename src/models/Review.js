const mongoose = require('mongoose');
const crypto = require('crypto');

const pseudoAdjectives = [
  'Helpful',
  'Honest',
  'Local',
  'Trusted',
  'Friendly',
  'Careful',
  'Kind',
  'Bright',
  'Fair',
  'Calm',
  'Curious',
  'Reliable',
];

const pseudoNouns = [
  'Neighbor',
  'Reviewer',
  'Customer',
  'Visitor',
  'Explorer',
  'Scout',
  'Resident',
  'Guest',
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

    // Stored internally only.
    // Do not expose this in API responses.
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
  {
    timestamps: true,
  }
);

// One user can review one business only once
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

// Update business rating after create/update
reviewSchema.post('save', async function () {
  await updateBusinessRating(this.business, this.constructor);
});

// Update business rating after delete
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await updateBusinessRating(doc.business, doc.constructor);
  }
});

module.exports = mongoose.model('Review', reviewSchema);