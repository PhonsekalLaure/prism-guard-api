const express = require('express');
const router = express.Router();
const profileController = require('@controllers/profileController');
const { requireAuth } = require('@middlewares/authMiddleware');

// All profile routes require authentication
router.use(requireAuth);

// GET  /api/web/profile/me
router.get('/me', profileController.getProfile);

module.exports = router;
