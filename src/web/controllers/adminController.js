const adminService = require('@services/adminService');

function normalizeAdminPayload(body = {}) {
  const payload = {};

  Object.keys(body).forEach((key) => {
    const value = body[key];
    payload[key] = typeof value === 'string' ? value.trim() : value;
  });

  return payload;
}

async function getAllAdmins(req, res) {
  try {
    const admins = await adminService.getAllAdmins();
    return res.json(admins);
  } catch (error) {
    console.error('[getAllAdmins Error]:', error);
    return res.status(error.status || 500).json({ error: error.message });
  }
}

async function createAdmin(req, res) {
  try {
    const data = normalizeAdminPayload(req.body);
    const result = await adminService.createAdmin(data, req.user?.id);
    return res.status(201).json({
      message: 'Admin account created successfully. An invitation email was sent so the new admin can set their password.',
      ...result,
    });
  } catch (error) {
    console.error('[createAdmin Error]:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to create admin.' });
  }
}

async function updateAdmin(req, res) {
  try {
    const data = normalizeAdminPayload(req.body);
    const result = await adminService.updateAdmin(req.params.id, data, req.user.id);
    return res.json({
      message: 'Admin account updated successfully.',
      ...result,
    });
  } catch (error) {
    console.error('[updateAdmin Error]:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to update admin.' });
  }
}

async function deleteAdmin(req, res) {
  try {
    const result = await adminService.deleteAdmin(req.params.id, req.user.id);
    return res.json({
      message: 'Admin account deleted successfully.',
      ...result,
    });
  } catch (error) {
    console.error('[deleteAdmin Error]:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to delete admin.' });
  }
}

module.exports = {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
