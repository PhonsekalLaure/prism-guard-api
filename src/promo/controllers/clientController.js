const clientService = require('../services/clientService');

/**
 * GET /api/promo/clients
 */
async function getPromoClients(req, res) {
  try {
    const clients = await clientService.getPromoClients(req.query || {});

    return res.json({
      data: clients,
      clients,
      metadata: {
        total: clients.length,
      },
    });
  } catch (err) {
    console.error('[getPromoClients Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getPromoClients,
};
