const clientService = require('@services/clientService');

/**
 * GET /api/web/clients
 */
async function getAllClients(req, res) {
  try {
    const clients = await clientService.getAllClients();
    return res.json(clients);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getAllClients
};
