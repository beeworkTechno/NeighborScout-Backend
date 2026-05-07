const Business = require('../models/Business');

// @desc    Get all businesses (with optional filters)
// @route   GET /api/businesses
// @access  Public
const getBusinesses = async (req, res) => {
  try {
    const { category, search, sortBy } = req.query;
    let query = {};

    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };

    let sort = { createdAt: -1 };
    if (sortBy === 'rating') sort = { averageRating: -1 };
    if (sortBy === 'reviews') sort = { reviewCount: -1 };

    const businesses = await Business.find(query)
      .populate('owner', 'name avatar')
      .sort(sort);

    res.json(businesses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single business
// @route   GET /api/businesses/:id
// @access  Public
const getBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate('owner', 'name avatar');
    if (!business) return res.status(404).json({ message: 'Business not found' });
    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create business
// @route   POST /api/businesses
// @access  Private
const createBusiness = async (req, res) => {
  try {
    const { name, description, category, address, phone, location } = req.body;

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
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update business
// @route   PUT /api/businesses/:id
// @access  Private (owner only)
const updateBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this business' });
    }

    const updated = await Business.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete business
// @route   DELETE /api/businesses/:id
// @access  Private (owner only)
const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this business' });
    }

    await business.deleteOne();
    res.json({ message: 'Business removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBusinesses, getBusiness, createBusiness, updateBusiness, deleteBusiness };
