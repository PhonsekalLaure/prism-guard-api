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

// Require authentication for all deployed guards routes.
// Both admins (full view) and clients (scoped to their own sites) may access.
router.use(requireAuth, requireRole('admin', 'client'));

// Attach the caller's profile id so the service can scope to their sites when role = 'client'
router.use((req, _res, next) => {
  req.callerId = req.user.id;
  req.callerRole = req.profile.role;
  next();
});

// GET /api/web/deployed-guards
router.get('/', paginationMiddleware(6), filterMiddleware, getAllDeployedGuards);

// GET /api/web/deployed-guards/stats (Must be before /:id)
router.get('/stats', getDeployedGuardsStats);

// GET /api/web/deployed-guards/:id
router.get('/:id', getDeployedGuardDetails);

module.exports = router;

