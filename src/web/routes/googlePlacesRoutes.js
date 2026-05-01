const express = require('express');
const googlePlacesController = require('@controllers/googlePlacesController');
const { requireAuth, requireRole } = require('@middlewares/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/autocomplete', googlePlacesController.autocomplete);
router.get('/details', googlePlacesController.placeDetails);

module.exports = router;
