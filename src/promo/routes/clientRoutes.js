const express = require('express');
const { getPromoClients } = require('../controllers/clientController');

const router = express.Router();

// GET /api/promo/clients
router.get('/', getPromoClients);

module.exports = router;
