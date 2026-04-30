const { supabase, supabaseAdmin } = require('@src/supabaseClient');

/**
 * GET /api/web/profile/me
 * Returns the full profile for the authenticated client.
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('first_name, middle_name, last_name, contact_email, phone_number, role, avatar_url, status, employees(position, employee_id_number, hire_date), clients(company, billing_address)')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const emp    = profile.employees?.[0] || profile.employees || {};
    const client = profile.clients?.[0]   || profile.clients   || {};
    delete profile.employees;
    delete profile.clients;
    profile.position           = emp.position           || null;
    profile.employee_id_number = emp.employee_id_number || null;
    profile.hire_date          = emp.hire_date          || null;
    profile.company            = client.company         || null;
    profile.billing_address    = client.billing_address || null;

    return res.json(profile);
  } catch (err) {
    console.error('[getProfile Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/web/profile/me
 * Update contact person / representative fields.
 * Body: { firstName?, lastName?, middleName?, phone? }
 */
async function updateContactPerson(req, res) {
  try {
    const userId = req.user.id;
    const { firstName, lastName, middleName, phone } = req.body;

    const updates = {};
    if (firstName  !== undefined) updates.first_name   = firstName;
    if (lastName   !== undefined) updates.last_name    = lastName;
    if (middleName !== undefined) updates.middle_name  = middleName;
    if (phone      !== undefined) updates.phone_number = phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ message: 'Contact information updated successfully.' });
  } catch (err) {
    console.error('[updateContactPerson Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/web/profile/change-password
 * Verifies the current password by re-authenticating, then updates to the new one.
 * Body: { currentPassword, newPassword, confirmPassword }
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    // Verify current password by re-signing in (req.user comes from Supabase getUser)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Update password via admin API (no client token needed server-side)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[changePassword Error]:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getProfile, updateContactPerson, changePassword };
