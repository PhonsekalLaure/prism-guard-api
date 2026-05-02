const express = require('express');
const { requireAuth, requireRole, requireAdminPermission } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const { createRateLimitMiddleware } = require('@middlewares/rateLimitMiddleware');
const { uploadAny } = require('@middlewares/uploadMiddleware');
const {
  getAllClients,
  getClientDetails,
  getClientStats,
  getClientsList,
  getAllSitesList,
  createClient,
  updateClient,
  createClientSite,
  updateClientSite,
  deactivateClientSite,
  deactivateClient,
  relieveAllClientGuards,
} = require('@controllers/clientController');

const router = express.Router();

// Require all client web routes to be authenticated and accessed by admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/clients
router.get('/', requireAdminPermission('clients.read'), paginationMiddleware(6), filterMiddleware, getAllClients);

// POST /api/web/clients
router.post(
  '/',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  uploadAny,
  createClient
);

// GET /api/web/clients/stats (Must be before /:id)
router.get('/stats', requireAdminPermission('clients.read'), getClientStats);

// GET /api/web/clients/list (Must be before /:id)
router.get('/list', requireAdminPermission('clients.read'), getClientsList);

// GET /api/web/clients/sites (Must be before /:id)
router.get('/sites', requireAdminPermission('clients.read'), getAllSitesList);

// GET /api/web/clients/:id
router.get('/:id', requireAdminPermission('clients.read'), getClientDetails);

// PATCH /api/web/clients/:id
router.patch(
  '/:id',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  uploadAny,
  updateClient
);

router.post(
  '/:id/sites',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  createClientSite
);

router.patch(
  '/:id/sites/:siteId',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  updateClientSite
);

router.post(
  '/:id/sites/:siteId/deactivate',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  deactivateClientSite
);

router.post(
  '/:id/deactivate',
  requireAdminPermission('clients.write'),
  createRateLimitMiddleware('clientWrite'),
  deactivateClient
);

router.post(
  '/:id/relieve-all',
  requireAdminPermission('employees.write'),
  createRateLimitMiddleware('deploymentRelieve'),
  relieveAllClientGuards
);

module.exports = router;
