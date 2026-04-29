const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/mobile/auth/login
router.post('/login', authController.login);

// GET /api/mobile/auth/me
router.get('/me', authController.me);

module.exports = router;