const express = require('express');
const router = express.Router();

const {
  getBusinesses,
  getMyBusinesses,
  getBusiness,
  getBusinessPhoto,
  createBusiness,
  updateBusiness,
  autofillMissingBusinessAddresses,
  deleteBusiness,
} = require('../controllers/businessController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

/*
  IMPORTANT:
  Keep specific routes like /my and /admin/autofill-addresses
  above /:id routes, otherwise Express may treat "my" or "admin"
  as a business ID.
*/

router
  .route('/admin/autofill-addresses')
  .put(protect, autofillMissingBusinessAddresses);

router.route('/my').get(protect, getMyBusinesses);

router
  .route('/')
  .get(getBusinesses)
  .post(protect, upload.single('profilePhoto'), createBusiness);

router.route('/:id/photo').get(getBusinessPhoto);

router
  .route('/:id')
  .get(getBusiness)
  .put(protect, upload.single('profilePhoto'), updateBusiness)
  .delete(protect, deleteBusiness);

module.exports = router;