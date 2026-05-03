const clientService = require('@services/clientService');
const { formatPaginatedResponse } = require('@utils/pagination');
const { uploadBufferToCloudinary } = require('../../config/cloudinary');

function parseJsonField(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeClientPayload(body = {}) {
  const data = {};

  Object.keys(body).forEach((key) => {
    const rawValue = parseJsonField(body[key]);
    data[key] = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  });

  return data;
}

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

    const data = normalizeClientPayload(req.body);
    const files = req.files || [];
    const deploymentOrderUrlsByEmployeeId = new Map();

    for (const file of files) {
      if (file.fieldname === 'avatar') {
        data.avatarUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/clients/avatars', {
          actorKey: req.user?.id,
        });
      } else if (file.fieldname === 'contractUrl') {
        data.contractUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/clients/contracts', {
          actorKey: req.user?.id,
        });
      } else if (file.fieldname.startsWith('deployment_order_')) {
        const employeeId = file.fieldname.replace('deployment_order_', '');
        const deploymentOrderUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/employees/deployment_orders', {
          actorKey: req.user?.id,
        });
        deploymentOrderUrlsByEmployeeId.set(employeeId, deploymentOrderUrl);
      }
    }

    if (data.initialDeployment?.assignments?.length > 0) {
      data.initialDeployment = {
        ...data.initialDeployment,
        assignments: data.initialDeployment.assignments.map((assignment) => ({
          ...assignment,
          deploymentOrderUrl: deploymentOrderUrlsByEmployeeId.get(assignment.employeeId) || null,
        })),
      };
    }

    const { userId } = await clientService.createClient(data, req.user?.id);

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
    const data = normalizeClientPayload(req.body);
    const files = req.files || [];

    for (const file of files) {
      if (file.fieldname === 'avatar') {
        data.avatarUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/clients/avatars', {
          actorKey: req.user?.id,
        });
      } else if (file.fieldname === 'contractUrl') {
        data.contractUrl = await uploadBufferToCloudinary(file.buffer, 'prism_guard/clients/contracts', {
          actorKey: req.user?.id,
        });
      }
    }

    await clientService.updateClient(id, data);

    return res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('[updateClient Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update client' });
  }
}

async function createClientSite(req, res) {
  try {
    const { id } = req.params;
    const data = normalizeClientPayload(req.body);
    const site = await clientService.createClientSite(id, data);
    return res.status(201).json({ message: 'Client site created successfully', data: site });
  } catch (err) {
    console.error('[createClientSite Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to create client site' });
  }
}

async function updateClientSite(req, res) {
  try {
    const { id, siteId } = req.params;
    const data = normalizeClientPayload(req.body);
    const site = await clientService.updateClientSite(id, siteId, data);
    return res.json({ message: 'Client site updated successfully', data: site });
  } catch (err) {
    console.error('[updateClientSite Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to update client site' });
  }
}

async function deactivateClientSite(req, res) {
  try {
    const { id, siteId } = req.params;
    const site = await clientService.deactivateClientSite(id, siteId);
    return res.json({ message: 'Client site deactivated successfully', data: site });
  } catch (err) {
    console.error('[deactivateClientSite Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to deactivate client site' });
  }
}

async function deactivateClient(req, res) {
  try {
    const { id } = req.params;
    const result = await clientService.deactivateClient(id);
    return res.json({ message: 'Client deactivated successfully', data: result });
  } catch (err) {
    console.error('[deactivateClient Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to deactivate client' });
  }
}

async function relieveAllClientGuards(req, res) {
  try {
    const { id } = req.params;
    const { reliefDate } = req.body || {};
    const result = await clientService.relieveAllClientGuards(id, {
      reliefDate: reliefDate || null,
    });
    return res.json({ message: 'All client guards relieved successfully', data: result });
  } catch (err) {
    console.error('[relieveAllClientGuards Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to relieve client guards' });
  }
}

/**
 * GET /api/web/clients/sites
 */
async function getAllSitesList(req, res) {
  try {
    const sites = await clientService.getAllSitesList(req.query || {});
    return res.json(sites);
  } catch (err) {
    console.error('[getAllSitesList Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
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
  relieveAllClientGuards
};
