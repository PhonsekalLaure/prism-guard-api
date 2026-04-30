const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole, requireAdminPermission } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const { getAllClients, getClientDetails, getClientStats, getClientsList, getAllSitesList, createClient, updateClient } = require('@controllers/clientController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Require all client web routes to be authenticated and accessed by admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/clients
router.get('/', requireAdminPermission('clients.read'), paginationMiddleware(6), filterMiddleware, getAllClients);

// POST /api/web/clients
router.post('/', requireAdminPermission('clients.write'), upload.any(), createClient);

// GET /api/web/clients/stats (Must be before /:id)
router.get('/stats', requireAdminPermission('clients.read'), getClientStats);

// GET /api/web/clients/list (Must be before /:id)
router.get('/list', requireAdminPermission('clients.read'), getClientsList);

// GET /api/web/clients/sites (Must be before /:id)
router.get('/sites', requireAdminPermission('clients.read'), getAllSitesList);

// GET /api/web/clients/:id
router.get('/:id', requireAdminPermission('clients.read'), getClientDetails);

// PATCH /api/web/clients/:id
router.patch('/:id', requireAdminPermission('clients.write'), upload.any(), updateClient);

module.exports = router;
