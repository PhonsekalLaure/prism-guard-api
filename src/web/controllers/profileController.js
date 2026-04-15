const { supabaseAdmin } = require('../../supabaseClient');

/**
 * GET /api/web/profile/me
 * Headers: Authorization: Bearer <access_token>
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;

    // Fetch comprehensive profile data
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('first_name, middle_name, last_name, contact_email, phone_number, role, avatar_url, status, employees(position, employee_id_number, hire_date), clients(company, billing_address)')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const emp = profile.employees?.[0] || profile.employees || {};
    const client = profile.clients?.[0] || profile.clients || {};
    delete profile.employees;
    delete profile.clients;
    profile.position = emp.position || null;
    profile.employee_id_number = emp.employee_id_number || null;
    profile.hire_date = emp.hire_date || null;
    profile.company = client.company || null;
    profile.billing_address = client.billing_address || null;

    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getProfile };
