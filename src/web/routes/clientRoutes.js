const express = require('express');
const { requireAuth, requireRole } = require('@middlewares/authMiddleware');
const paginationMiddleware = require('@middlewares/paginationMiddleware');
const filterMiddleware = require('@middlewares/filterMiddleware');
const { getAllClients, getClientDetails, getClientStats, getClientsList, createClient, updateClient } = require('@controllers/clientController');

const router = express.Router();

// Require all client web routes to be authenticated and accessed by admins
router.use(requireAuth, requireRole('admin'));

// GET /api/web/clients
router.get('/', paginationMiddleware(6), filterMiddleware, getAllClients);

// POST /api/web/clients
router.post('/', createClient);

// GET /api/web/clients/stats (Must be before /:id)
router.get('/stats', getClientStats);

// GET /api/web/clients/list (Must be before /:id)
router.get('/list', getClientsList);

// GET /api/web/clients/:id
router.get('/:id', getClientDetails);

// PATCH /api/web/clients/:id
router.patch('/:id', updateClient);

module.exports = router;
