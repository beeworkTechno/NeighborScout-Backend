const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Business description is required'],
      trim: true,
    },

    category: {
      type: String,
      required: [true, 'Business category is required'],
      trim: true,
    },

    address: {
      type: String,
      default: 'Address not provided',
      trim: true,
    },

    phone: {
      type: String,
      default: '',
      trim: true,
    },

    profilePhoto: {
      type: String,
      default: '',
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },

      coordinates: {
        type: [Number],
        required: [true, 'Business location coordinates are required'],
        validate: {
          validator: function (value) {
            return (
              Array.isArray(value) &&
              value.length === 2 &&
              typeof value[0] === 'number' &&
              typeof value[1] === 'number' &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90
            );
          },
          message:
            'Location coordinates must be valid [longitude, latitude] numbers.',
        },
      },
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

businessSchema.index({
  location: '2dsphere',
});

module.exports = mongoose.model('Business', businessSchema);