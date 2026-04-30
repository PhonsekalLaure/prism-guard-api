const { supabaseAdmin } = require('@src/supabaseClient');
const { supabase } = require('@src/supabaseClient');
const { buildBadRequestError } = require('@utils/requestValidation');

/**
 * Computes the human-readable contract status from dates.
 */
function getContractStatus(contractStartDate, contractEndDate) {
  if (!contractStartDate || !contractEndDate) return 'No Contract';
  const now = new Date();
  const start = new Date(contractStartDate);
  const end = new Date(contractEndDate);
  if (now < start) return 'Upcoming';
  if (now > end) return 'Expired';
  return 'Active';
}

/**
 * GET /api/web/profile/me
 * Returns the full profile for the authenticated client user.
 *
 * @param {string} userId — UUID from req.user.id
 */
async function getProfile(userId) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      contact_email,
      phone_number,
      role,
      avatar_url,
      status,
      created_at,
      clients (
        company,
        billing_address,
        contract_start_date,
        contract_end_date,
        contract_url,
        rate_per_guard,
        billing_type
      )
    `)
    .eq('id', userId)
    .single();

  if (error || !profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  const client = Array.isArray(profile.clients)
    ? profile.clients[0]
    : (profile.clients || {});

  const contractStatus = getContractStatus(
    client.contract_start_date,
    client.contract_end_date
  );

  return {
    id: profile.id,
    first_name: profile.first_name,
    middle_name: profile.middle_name || null,
    last_name: profile.last_name,
    contact_email: profile.contact_email,
    phone_number: profile.phone_number,
    role: profile.role,
    avatar_url: profile.avatar_url || null,
    status: profile.status,
    client_since: profile.created_at,
    company: client.company || null,
    billing_address: client.billing_address || null,
    contract_start_date: client.contract_start_date || null,
    contract_end_date: client.contract_end_date || null,
    contract_url: client.contract_url || null,
    contract_status: contractStatus,
    rate_per_guard: client.rate_per_guard || null,
    billing_type: client.billing_type || null,
  };
}

/**
 * PATCH /api/web/profile/me
 * Updates contact person / representative fields for the authenticated user.
 *
 * @param {string} userId
 * @param {{ firstName?, lastName?, middleName?, phone? }} data
 */
async function updateContactPerson(userId, data) {
  const profileUpdates = {};

  if (data.firstName !== undefined) {
    profileUpdates.first_name = data.firstName?.trim() || null;
  }
  if (data.lastName !== undefined) {
    profileUpdates.last_name = data.lastName?.trim() || null;
  }
  if (data.middleName !== undefined) {
    profileUpdates.middle_name = data.middleName?.trim() || null;
  }
  if (data.phone !== undefined) {
    profileUpdates.phone_number = data.phone?.trim() || null;
  }

  if (Object.keys(profileUpdates).length === 0) {
    throw buildBadRequestError('No fields provided to update.');
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  return { message: 'Contact person updated successfully' };
}

/**
 * POST /api/web/profile/change-password
 * Changes the authenticated user's password via Supabase Admin API.
 *
 * @param {string} accessToken — the user's current access token (to verify identity)
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string, confirmPassword: string }} data
 */
async function changePassword(accessToken, userId, data) {
  const { currentPassword, newPassword, confirmPassword } = data;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw buildBadRequestError('All password fields are required.');
  }

  if (newPassword !== confirmPassword) {
    throw buildBadRequestError('New password and confirmation do not match.');
  }

  if (newPassword.length < 8) {
    throw buildBadRequestError('New password must be at least 8 characters.');
  }

  // Verify current password by attempting a re-sign-in
  const { data: profileData } = await supabaseAdmin
    .from('profiles')
    .select('contact_email')
    .eq('id', userId)
    .single();

  if (!profileData?.contact_email) {
    const err = new Error('Could not verify current credentials.');
    err.status = 400;
    throw err;
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profileData.contact_email,
    password: currentPassword,
  });

  if (signInError) {
    const err = new Error('Current password is incorrect.');
    err.status = 400;
    throw err;
  }

  // Update password via admin API
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    const err = new Error(updateError.message);
    err.status = 500;
    throw err;
  }

  return { message: 'Password updated successfully' };
}

module.exports = { getProfile, updateContactPerson, changePassword };
