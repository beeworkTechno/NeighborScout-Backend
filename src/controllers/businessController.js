const Business = require('../models/Business');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

const addBusinessPageUrl = (business) => {
  if (!business) return business;

  const businessObject =
    typeof business.toObject === 'function' ? business.toObject() : business;

  return {
    ...businessObject,
    businessPageUrl: `${FRONTEND_URL}/business/${businessObject._id}`,
  };
};

const addBusinessPageUrls = (businesses) => {
  return businesses.map((business) => addBusinessPageUrl(business));
};

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

    if (sortBy === 'popular') {
      sort = {
        reviewCount: -1,
        averageRating: -1,
        createdAt: -1,
      };
    }

    const businesses = await Business.find(query)
      .populate('owner', 'name avatar')
      .sort(sort);

    res.json(addBusinessPageUrls(businesses));
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

    res.json(addBusinessPageUrls(businesses));
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

    res.json(addBusinessPageUrl(business));
  } catch (error) {
    console.log('Get Business Error:', error);

    res.status(500).json({
      message: 'Failed to load business.',
    });
  }
};

// @desc    Create business
// @route   POST /api/businesses
// @access  Private business users only
const createBusiness = async (req, res) => {
  try {
    if (req.user.role !== 'business') {
      return res.status(403).json({
        message: 'Only business accounts can create business listings.',
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

    if (!name || !description || !category) {
      return res.status(400).json({
        message: 'Name, description, and category are required.',
      });
    }

    if (
      !location ||
      !Array.isArray(location.coordinates) ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        message:
          'Business location is required. Please provide longitude and latitude.',
      });
    }

    const longitude = Number(location.coordinates[0]);
    const latitude = Number(location.coordinates[1]);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: 'Invalid business location coordinates.',
      });
    }

    const business = await Business.create({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      address: address?.trim() || 'Address not provided',
      phone: phone?.trim() || '',
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      owner: req.user._id,
    });

    const createdBusiness = await Business.findById(business._id).populate(
      'owner',
      'name avatar email'
    );

    res.status(201).json(addBusinessPageUrl(createdBusiness));
  } catch (error) {
    console.log('Create Business Error:', error);

    res.status(500).json({
      message: error.message || 'Failed to create business.',
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

    const updateData = {
      ...req.body,
    };

    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    if (updateData.description) {
      updateData.description = updateData.description.trim();
    }

    if (updateData.category) {
      updateData.category = updateData.category.trim();
    }

    if (updateData.address) {
      updateData.address = updateData.address.trim();
    }

    if (updateData.phone) {
      updateData.phone = updateData.phone.trim();
    }

    if (updateData.location?.coordinates) {
      const longitude = Number(updateData.location.coordinates[0]);
      const latitude = Number(updateData.location.coordinates[1]);

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          message: 'Invalid business location coordinates.',
        });
      }

      updateData.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    const updated = await Business.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate('owner', 'name avatar email');

    res.json(addBusinessPageUrl(updated));
  } catch (error) {
    console.log('Update Business Error:', error);

    res.status(500).json({
      message: error.message || 'Failed to update business.',
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
      deletedBusinessId: req.params.id,
      deletedBusinessPageUrl: `${FRONTEND_URL}/business/${req.params.id}`,
    });
  } catch (error) {
    console.log('Delete Business Error:', error);

    res.status(500).json({
      message: error.message || 'Failed to delete business.',
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