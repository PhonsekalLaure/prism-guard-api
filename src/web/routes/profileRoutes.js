const express = require('express');
const router = express.Router();
const profileController = require('@controllers/profileController');
const { requireAuth } = require('@middlewares/authMiddleware');

// All profile routes require authentication
router.use(requireAuth);

// GET /api/web/profile/me
router.get('/me', profileController.getProfile);

// PATCH /api/web/profile/me
router.patch('/me', profileController.updateContactPerson);

// POST /api/web/profile/change-password
router.post('/change-password', profileController.changePassword);

module.exports = router;
