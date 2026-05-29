const express = require('express');
const router = express.Router();

const {
  getBusinesses,
  getMyBusinesses,
  getBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
} = require('../controllers/businessController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router
  .route('/')
  .get(getBusinesses)
  .post(protect, upload.single('profilePhoto'), createBusiness);

router.route('/my').get(protect, getMyBusinesses);

router
  .route('/:id')
  .get(getBusiness)
  .put(protect, upload.single('profilePhoto'), updateBusiness)
  .delete(protect, deleteBusiness);

module.exports = router;