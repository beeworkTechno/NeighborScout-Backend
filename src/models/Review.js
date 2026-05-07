const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
reviewSchema.index({ business: 1, user: 1 }, { unique: true });

// After saving a review, update business averageRating
reviewSchema.post('save', async function () {
  const Business = require('./Business');
  const stats = await this.constructor.aggregate([
    { $match: { business: this.business } },
    {
      $group: {
        _id: '$business',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Business.findByIdAndUpdate(this.business, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    });
  }
});

// Also update on delete
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    const Business = require('./Business');
    const stats = await doc.constructor.aggregate([
      { $match: { business: doc.business } },
      {
        $group: {
          _id: '$business',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    await Business.findByIdAndUpdate(doc.business, {
      averageRating: stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0,
      reviewCount: stats.length > 0 ? stats[0].count : 0,
    });
  }
});

module.exports = mongoose.model('Review', reviewSchema);
