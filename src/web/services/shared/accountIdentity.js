const { supabaseAdmin } = require('@src/supabaseClient');
const { buildBadRequestError } = require('@utils/requestValidation');

function normalizeEmailAddress(rawEmail, fieldLabel = 'Email address') {
  if (!rawEmail || typeof rawEmail !== 'string') {
    throw buildBadRequestError(`${fieldLabel} is required.`);
  }

  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw buildBadRequestError(`${fieldLabel} is invalid.`);
  }

  return normalizedEmail;
}

function mapEmailConflictError(error) {
  const message = error?.message || 'Failed to update email address.';
  const lowered = message.toLowerCase();

  if (
    lowered.includes('already registered')
    || lowered.includes('already been registered')
    || lowered.includes('duplicate key value')
    || lowered.includes('profiles_contact_email_key')
    || lowered.includes('email_exists')
  ) {
    return buildBadRequestError('Email address is already in use.');
  }

  return error;
}

async function restoreProfileState(userId, role, previousProfileState) {
  if (!previousProfileState) return;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(previousProfileState)
    .eq('id', userId)
    .eq('role', role);

  if (error) {
    throw error;
  }
}

async function restoreAuthEmail(userId, previousEmail) {
  if (!previousEmail) return;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: previousEmail,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }
}

async function updateAccountProfileAndAuthEmail({
  userId,
  role,
  profilePatch = {},
  previousProfileState = null,
}) {
  const patchKeys = Object.keys(profilePatch);
  const nextEmail = profilePatch.contact_email;
  const previousEmail = previousProfileState?.contact_email || null;
  const emailChanged = nextEmail !== undefined && nextEmail !== previousEmail;

  if (patchKeys.length === 0) {
    return { profileUpdated: false, emailChanged: false };
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId)
    .eq('role', role);

  if (profileError) {
    throw mapEmailConflictError(profileError);
  }

  if (!emailChanged) {
    return { profileUpdated: true, emailChanged: false };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: nextEmail,
    email_confirm: true,
  });

  if (authError) {
    await restoreProfileState(userId, role, previousProfileState);
    throw mapEmailConflictError(authError);
  }

  return { profileUpdated: true, emailChanged: true };
}

module.exports = {
  normalizeEmailAddress,
  mapEmailConflictError,
  restoreProfileState,
  restoreAuthEmail,
  updateAccountProfileAndAuthEmail,
};
