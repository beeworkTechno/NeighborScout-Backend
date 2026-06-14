const Business = require('../models/Business');
const { reverseGeocodeCoordinates } = require('../utils/reverseGeocode');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

const isMissingAddress = (address = '') => {
  const value = String(address || '').trim().toLowerCase();

  return (
    !value ||
    value === 'address not provided' ||
    value === 'not provided' ||
    value === 'n/a'
  );
};

const isSuperAdmin = (user) => {
  return Boolean(
    user &&
      ['superadmin', 'super-admin', 'super_admin'].includes(user.role)
  );
};

const addBusinessPageUrl = (business) => {
  if (!business) return business;

  const businessObject =
    typeof business.toObject === 'function' ? business.toObject() : business;

  const hasProfilePhoto = Boolean(
    businessObject.profilePhoto && businessObject.profilePhoto.contentType
  );

  delete businessObject.profilePhoto;

  return {
    ...businessObject,
    hasProfilePhoto,
    photoUrl: hasProfilePhoto
      ? `/api/businesses/${businessObject._id}/photo`
      : '',
    businessPageUrl: `${FRONTEND_URL}/business/${businessObject._id}`,
  };
};

const addBusinessPageUrls = (businesses) => {
  return businesses.map((business) => addBusinessPageUrl(business));
};

const parseLocationFromBody = (body) => {
  let location = body.location;

  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch (error) {
      location = null;
    }
  }

  if (
    location &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2
  ) {
    return {
      longitude: Number(location.coordinates[0]),
      latitude: Number(location.coordinates[1]),
    };
  }

  if (body.latitude !== undefined && body.longitude !== undefined) {
    return {
      longitude: Number(body.longitude),
      latitude: Number(body.latitude),
    };
  }

  return null;
};

const isValidCoordinates = (longitude, latitude) => {
  return (
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const getAddressFromCoordinates = async (latitude, longitude) => {
  const generatedAddress = await reverseGeocodeCoordinates(latitude, longitude);

  return generatedAddress || 'Address not provided';
};

const getBusinessCoordinates = (business) => {
  if (
    business?.location?.coordinates &&
    Array.isArray(business.location.coordinates) &&
    business.location.coordinates.length === 2
  ) {
    const longitude = Number(business.location.coordinates[0]);
    const latitude = Number(business.location.coordinates[1]);

    if (isValidCoordinates(longitude, latitude)) {
      return {
        longitude,
        latitude,
      };
    }
  }

  return null;
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
      query.$or = [
        {
          name: {
            $regex: search,
            $options: 'i',
          },
        },
        {
          category: {
            $regex: search,
            $options: 'i',
          },
        },
        {
          address: {
            $regex: search,
            $options: 'i',
          },
        },
      ];
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
      .select('-profilePhoto.data')
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
      .select('-profilePhoto.data')
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
    const business = await Business.findById(req.params.id)
      .select('-profilePhoto.data')
      .populate('owner', 'name avatar email');

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

// @desc    Get business photo from MongoDB
// @route   GET /api/businesses/:id/photo
// @access  Public
const getBusinessPhoto = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).select(
      'profilePhoto'
    );

    if (!business || !business.profilePhoto || !business.profilePhoto.data) {
      return res.status(404).json({
        message: 'Business photo not found.',
      });
    }

    res.set('Content-Type', business.profilePhoto.contentType || 'image/jpeg');
    res.send(business.profilePhoto.data);
  } catch (error) {
    console.log('Get Business Photo Error:', error);

    res.status(500).json({
      message: 'Failed to load business photo.',
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

    const { name, description, category, address, phone } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({
        message: 'Name, description, and category are required.',
      });
    }

    const parsedLocation = parseLocationFromBody(req.body);

    if (!parsedLocation) {
      return res.status(400).json({
        message:
          'Business location is required. Please provide longitude and latitude.',
      });
    }

    const { longitude, latitude } = parsedLocation;

    if (!isValidCoordinates(longitude, latitude)) {
      return res.status(400).json({
        message: 'Invalid business location coordinates.',
      });
    }

    let finalAddress = address?.trim() || '';

    if (isMissingAddress(finalAddress)) {
      finalAddress = await getAddressFromCoordinates(latitude, longitude);
    }

    const businessData = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      address: finalAddress,
      phone: phone?.trim() || '',
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      owner: req.user._id,
    };

    if (req.file) {
      businessData.profilePhoto = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    const business = await Business.create(businessData);

    const createdBusiness = await Business.findById(business._id)
      .select('-profilePhoto.data')
      .populate('owner', 'name avatar email');

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

    const parsedLocation = parseLocationFromBody(req.body);

    if (req.body.name) {
      business.name = req.body.name.trim();
    }

    if (req.body.description) {
      business.description = req.body.description.trim();
    }

    if (req.body.category) {
      business.category = req.body.category.trim();
    }

    if (req.body.phone !== undefined) {
      business.phone = req.body.phone.trim();
    }

    if (req.file) {
      business.profilePhoto = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    if (parsedLocation) {
      const { longitude, latitude } = parsedLocation;

      if (!isValidCoordinates(longitude, latitude)) {
        return res.status(400).json({
          message: 'Invalid business location coordinates.',
        });
      }

      business.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    const currentCoordinates = parsedLocation || getBusinessCoordinates(business);

    if (req.body.address !== undefined) {
      const requestedAddress = req.body.address.trim();

      if (isMissingAddress(requestedAddress) && currentCoordinates) {
        business.address = await getAddressFromCoordinates(
          currentCoordinates.latitude,
          currentCoordinates.longitude
        );
      } else {
        business.address = requestedAddress || 'Address not provided';
      }
    } else if (isMissingAddress(business.address) && currentCoordinates) {
      business.address = await getAddressFromCoordinates(
        currentCoordinates.latitude,
        currentCoordinates.longitude
      );
    }

    const savedBusiness = await business.save();

    const updated = await Business.findById(savedBusiness._id)
      .select('-profilePhoto.data')
      .populate('owner', 'name avatar email');

    res.json(addBusinessPageUrl(updated));
  } catch (error) {
    console.log('Update Business Error:', error);

    res.status(500).json({
      message: error.message || 'Failed to update business.',
    });
  }
};

// @desc    Autofill missing addresses for old businesses
// @route   PUT /api/businesses/admin/autofill-addresses
// @access  Superadmin only
const autofillMissingBusinessAddresses = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({
        message: 'Only super admins can autofill business addresses.',
      });
    }

    const businesses = await Business.find({
      $or: [
        {
          address: {
            $exists: false,
          },
        },
        {
          address: '',
        },
        {
          address: null,
        },
        {
          address: 'Address not provided',
        },
      ],
    });

    let updatedCount = 0;
    let skippedCount = 0;

    for (const business of businesses) {
      const coordinates = getBusinessCoordinates(business);

      if (!coordinates) {
        skippedCount += 1;
        continue;
      }

      const address = await reverseGeocodeCoordinates(
        coordinates.latitude,
        coordinates.longitude
      );

      if (address) {
        business.address = address;
        await business.save();
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    res.json({
      message: 'Missing business addresses autofilled.',
      updatedCount,
      skippedCount,
    });
  } catch (error) {
    console.log('Autofill Business Addresses Error:', error);

    res.status(500).json({
      message: 'Failed to autofill business addresses.',
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
  getBusinessPhoto,
  createBusiness,
  updateBusiness,
  autofillMissingBusinessAddresses,
  deleteBusiness,
};