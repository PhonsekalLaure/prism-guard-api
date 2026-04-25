const express = require('express');
const { requireAuth, requireRole } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const {
  getAllDeployedGuards,
  getDeployedGuardsStats,
  getDeployedGuardDetails,
} = require('@controllers/deployedGuardsController');

const router = express.Router();

// Require all deployed guards routes to be authenticated and accessed by admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/deployed-guards
router.get('/', paginationMiddleware(6), filterMiddleware, getAllDeployedGuards);

// GET /api/web/deployed-guards/stats (Must be before /:id)
router.get('/stats', getDeployedGuardsStats);

// GET /api/web/deployed-guards/:id
router.get('/:id', getDeployedGuardDetails);

module.exports = router;
