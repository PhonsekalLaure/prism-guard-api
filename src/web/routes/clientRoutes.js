const express = require('express');
const { requireAuth, requireRole } = require('@middlewares/authMiddleware');
const { getAllClients } = require('@controllers/clientController');

const router = express.Router();

// Require all client web routes to be authenticated and accessed by admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/clients
router.get('/', getAllClients);

module.exports = router;
