const express = require('express');
const router = express.Router();
const authController = require('@controllers/authController');

// POST /api/web/auth/login
router.post('/login', authController.login);

// GET /api/web/auth/me
router.get('/me', authController.me);

// POST /api/web/auth/logout
router.post('/logout', authController.logout);

module.exports = router;
