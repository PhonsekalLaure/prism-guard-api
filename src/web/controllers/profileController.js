const { supabaseAdmin } = require('@src/supabaseClient');

/**
 * GET /api/web/profile/me
 * Returns the full profile for the authenticated client.
 */
async function getProfile(req, res) {
  try {
    const profile = await profileService.getProfile(req.user.id);
    return res.json(profile);
  } catch (err) {
    console.error('[getProfile Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * PATCH /api/web/profile/me
 * Body: { firstName?, lastName?, middleName?, phone? }
 */
async function updateContactPerson(req, res) {
  try {
    const result = await profileService.updateContactPerson(req.user.id, req.body);
    return res.json(result);
  } catch (err) {
    console.error('[updateContactPerson Error]:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

module.exports = { getProfile };
