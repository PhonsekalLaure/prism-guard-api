const { supabase, supabaseAdmin } = require('../../supabaseClient');

/**
 * Roles that are allowed to log in through the web portal.
 * - admin  → HRIS dashboard
 * - client → CMS dashboard
 */
const WEB_ALLOWED_ROLES = ['admin', 'client'];

/**
 * Authenticate a user with email + password via Supabase Auth,
 * then fetch their profile to determine role-based access.
 *
 * @param {string} email
 * @param {string} password
 * @returns {{ user, session, profile, redirect }}
 */
async function login(email, password) {
  // 1. Sign in through Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    const err = new Error(authError.message);
    err.status = 401;
    throw err;
  }

  const { user, session } = authData;

  // 2. Fetch the user's profile (role, name, avatar, etc.)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name, role, avatar_url, status, employees(position, employee_id_number, hire_date)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const err = new Error('User profile not found');
    err.status = 404;
    throw err;
  }

  // 3. Block inactive accounts
  if (profile.status !== 'active') {
    const err = new Error('Your account has been deactivated. Please contact an administrator.');
    err.status = 403;
    throw err;
  }

  // 4. Block roles that aren't allowed on the web portal (e.g. employees / guards)
  if (!WEB_ALLOWED_ROLES.includes(profile.role)) {
    const err = new Error('You do not have access to this portal. Please use the mobile app.');
    err.status = 403;
    throw err;
  }

  // 5. Determine redirect path based on role
  const redirect = profile.role === 'admin' ? '/dashboard' : '/cms/dashboard';

  // Position logic handling 1-to-X relation
  const emp = profile.employees?.[0] || profile.employees || {};

  return {
    user: { id: user.id, email: user.email },
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
    profile: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      avatar_url: profile.avatar_url,
      position: emp.position || null,
      employee_id_number: emp.employee_id_number || null,
      hire_date: emp.hire_date || null,
    },
    redirect,
  };
}

/**
 * Validate an existing access token and return the associated profile.
 * Used by the frontend to check if a stored session is still valid.
 *
 * @param {string} accessToken
 * @returns {{ user, profile, redirect }}
 */
async function getMe(accessToken) {
  // Verify the token with Supabase
  const { data: { user }, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    const err = new Error('Invalid or expired session');
    err.status = 401;
    throw err;
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('first_name, last_name, role, avatar_url, status, employees(position, employee_id_number, hire_date)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const err = new Error('User profile not found');
    err.status = 404;
    throw err;
  }

  if (profile.status !== 'active') {
    const err = new Error('Your account has been deactivated');
    err.status = 403;
    throw err;
  }

  if (!WEB_ALLOWED_ROLES.includes(profile.role)) {
    const err = new Error('You do not have access to this portal');
    err.status = 403;
    throw err;
  }

  const redirect = profile.role === 'admin' ? '/dashboard' : '/cms/dashboard';

  const emp = profile.employees?.[0] || profile.employees || {};

  return {
    user: { id: user.id, email: user.email },
    profile: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: profile.role,
      avatar_url: profile.avatar_url,
      position: emp.position || null,
      employee_id_number: emp.employee_id_number || null,
      hire_date: emp.hire_date || null,
    },
    redirect,
  };
}

/**
 * Sign out a user server-side by invalidating their session.
 *
 * @param {string} accessToken
 */
async function logout(accessToken) {
  // Verify the token to get the user id, then sign them out via admin API
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    // Token already invalid — nothing to do
    return;
  }

  await supabaseAdmin.auth.admin.signOut(user.id);
}

module.exports = { login, getMe, logout };
