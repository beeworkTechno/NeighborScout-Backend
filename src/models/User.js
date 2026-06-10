const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      minlength: 6,
      required: function () {
        return !this.googleId;
      },
      default: undefined,
    },

    // External avatar URL, for example Google profile photo
    avatar: {
      type: String,
      default: '',
    },

    // Uploaded profile photo stored in MongoDB
    profilePhoto: {
      data: Buffer,
      contentType: String,
    },

    googleId: {
      type: String,
      default: '',
    },

    role: {
      type: String,
      enum: ['personal', 'business'],
      default: 'personal',
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password') || !this.password) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);