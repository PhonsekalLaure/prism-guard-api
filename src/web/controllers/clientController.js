const clientService = require('@services/clientService');
const { formatPaginatedResponse } = require('@utils/pagination');

/**
 * GET /api/web/clients
 */
async function getAllClients(req, res) {
  try {
    const { page, limit } = req.pagination;
    const filters = req.filters;
    
    const { clients, totalCount } = await clientService.getAllClients(page, limit, filters);
    
    return res.json(formatPaginatedResponse(clients, totalCount, page, limit));
  } catch (err) {
    console.error('[getAllClients Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/clients/:id
 */
async function getClientDetails(req, res) {
  try {
    const { id } = req.params;
    const client = await clientService.getClientDetails(id);
    return res.json(client);
  } catch (err) {
    console.error('[getClientDetails Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/clients/stats
 */
async function getClientStats(req, res) {
  try {
    const stats = await clientService.getClientStats();
    return res.json(stats);
  } catch (err) {
    console.error('[getClientStats Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/clients/list
 */
async function getClientsList(req, res) {
  try {
    const clients = await clientService.getClientsList();
    return res.json(clients);
  } catch (err) {
    console.error('[getClientsList Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * POST /api/web/clients
 */
async function createClient(req, res) {
  try {
    const {
      email,
      firstName,
      lastName,
      company,
      mobile
    } = req.body;

    // Basic validation
    if (!email || !firstName || !lastName || !company || !mobile) {
      return res.status(400).json({
        error: 'Missing required fields: email, firstName, lastName, company, and mobile are required.'
      });
    }

    const data = {};
    // Trim string inputs
    Object.keys(req.body).forEach(key => {
      data[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    });

    // Call service to create user in DB
    const { userId } = await clientService.createClient(data);

    return res.status(201).json({ message: 'Client created and invited successfully', userId });
  } catch (err) {
    console.error('[createClient Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create client' });
  }
}

/**
 * PATCH /api/web/clients/:id
 */
async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const data = {};

    // Trim string inputs
    Object.keys(req.body).forEach(key => {
      data[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
    });

    await clientService.updateClient(id, data);

    return res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('[updateClient Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update client' });
  }
}

module.exports = {
  getAllClients,
  getClientDetails,
  getClientStats,
  getClientsList,
  createClient,
  updateClient
};
