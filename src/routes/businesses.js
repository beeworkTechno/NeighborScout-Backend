const express = require('express');
const router = express.Router();

const {
  getBusinesses,
  getMyBusinesses,
  getBusiness,
  getBusinessPhoto,
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

router.route('/:id/photo').get(getBusinessPhoto);

router
  .route('/:id')
  .get(getBusiness)
  .put(protect, upload.single('profilePhoto'), updateBusiness)
  .delete(protect, deleteBusiness);

module.exports = router;