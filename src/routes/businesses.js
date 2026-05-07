const express = require('express');
const router = express.Router();
const {
  getBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
} = require('../controllers/businessController');
const { protect } = require('../middleware/auth');

router.route('/').get(getBusinesses).post(protect, createBusiness);
router.route('/:id').get(getBusiness).put(protect, updateBusiness).delete(protect, deleteBusiness);

module.exports = router;