const deployedGuardsService = require('@services/deployedGuardsService');
const { formatPaginatedResponse } = require('@utils/pagination');

/**
 * GET /api/web/deployed-guards
 */
async function getAllDeployedGuards(req, res) {
  try {
    const { page, limit } = req.pagination;
    const filters = req.filters;
    const callerId = req.callerId;
    const callerRole = req.callerRole;

    const { guards, totalCount } = await deployedGuardsService.getAllDeployedGuards(
      page, limit, filters, callerId, callerRole
    );

    return res.json(formatPaginatedResponse(guards, totalCount, page, limit));
  } catch (err) {
    console.error('[getAllDeployedGuards Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/deployed-guards/stats
 */
async function getDeployedGuardsStats(req, res) {
  try {
    const callerId = req.callerId;
    const callerRole = req.callerRole;

    const stats = await deployedGuardsService.getDeployedGuardsStats(callerId, callerRole);
    return res.json(stats);
  } catch (err) {
    console.error('[getDeployedGuardsStats Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/deployed-guards/:id
 */
async function getDeployedGuardDetails(req, res) {
  try {
    const { id } = req.params;
    const guard = await deployedGuardsService.getDeployedGuardDetails(id);
    return res.json(guard);
  } catch (err) {
    console.error('[getDeployedGuardDetails Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = {
  getAllDeployedGuards,
  getDeployedGuardsStats,
  getDeployedGuardDetails,
};

