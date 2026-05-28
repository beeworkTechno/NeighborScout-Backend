const Business = require('../models/Business');

// @desc    Get all businesses with optional filters
// @route   GET /api/businesses
// @access  Public
const getBusinesses = async (req, res) => {
  try {
    const { category, search, sortBy } = req.query;

    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.name = {
        $regex: search,
        $options: 'i',
      };
    }

    let sort = {
      createdAt: -1,
    };

    if (sortBy === 'rating') {
      sort = {
        averageRating: -1,
      };
    }

    if (sortBy === 'reviews') {
      sort = {
        reviewCount: -1,
      };
    }

    const businesses = await Business.find(query)
      .populate('owner', 'name avatar')
      .sort(sort);

    res.json(businesses);
  } catch (error) {
    console.log('Get Businesses Error:', error);

    res.status(500).json({
      message: 'Failed to load businesses.',
    });
  }
};

// @desc    Get businesses owned by logged-in user
// @route   GET /api/businesses/my
// @access  Private
const getMyBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find({
      owner: req.user._id,
    })
      .populate('owner', 'name avatar email')
      .sort({
        createdAt: -1,
      });

    res.json(businesses);
  } catch (error) {
    console.log('Get My Businesses Error:', error);

    res.status(500).json({
      message: 'Failed to load your businesses.',
    });
  }
};

// @desc    Get single business
// @route   GET /api/businesses/:id
// @access  Public
const getBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate(
      'owner',
      'name avatar email'
    );

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
      });
    }

    res.json(business);
  } catch (error) {
    console.log('Get Business Error:', error);

    res.status(500).json({
      message: 'Failed to load business.',
    });
  }
};

// @desc    Create business
// @route   POST /api/businesses
// @access  Private
const createBusiness = async (req, res) => {
  try {
    if (req.user.role !== 'business') {
      return res.status(403).json({
        message: 'Only business users can create business listings.',
      });
    }

    const {
      name,
      description,
      category,
      address,
      phone,
      location,
    } = req.body;

    if (!name || !description || !category || !address) {
      return res.status(400).json({
        message:
          'Name, description, category, and address are required.',
      });
    }

    const business = await Business.create({
      name,
      description,
      category,
      address,
      phone,
      location,
      owner: req.user._id,
    });

    res.status(201).json(business);
  } catch (error) {
    console.log('Create Business Error:', error);

    res.status(500).json({
      message: 'Failed to create business.',
    });
  }
};

// @desc    Update business
// @route   PUT /api/businesses/:id
// @access  Private owner only
const updateBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
      });
    }

    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized to update this business',
      });
    }

    const updated = await Business.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.json(updated);
  } catch (error) {
    console.log('Update Business Error:', error);

    res.status(500).json({
      message: 'Failed to update business.',
    });
  }
};

// @desc    Delete business
// @route   DELETE /api/businesses/:id
// @access  Private owner only
const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
      });
    }

    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Not authorized to delete this business',
      });
    }

    await business.deleteOne();

    res.json({
      message: 'Business removed',
    });
  } catch (error) {
    console.log('Delete Business Error:', error);

    res.status(500).json({
      message: 'Failed to delete business.',
    });
  }
};

module.exports = {
  getBusinesses,
  getMyBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
};