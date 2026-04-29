const { supabase, supabaseAdmin } = require('../../supabaseClient');

const MOBILE_ALLOWED_ROLES = ['employee'];

async function login(email, password) {
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    const err = new Error(authError.message);
    err.status = 401;
    throw err;
  }

  const { user, session } = authData;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('first_name, middle_name, last_name, role, avatar_url, status, employees(position, employee_id_number, hire_date)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    const err = new Error('User profile not found');
    err.status = 404;
    throw err;
  }

  if (profile.status !== 'active') {
    const err = new Error('Your account has been deactivated. Please contact an administrator.');
    err.status = 403;
    throw err;
  }

  if (!MOBILE_ALLOWED_ROLES.includes(profile.role)) {
    const err = new Error('Access denied. This app is for security guards only.');
    err.status = 403;
    throw err;
  }

  const emp = profile.employees?.[0] || profile.employees || {};

  if (emp.position !== 'Security Guard') {
    const err = new Error('Access denied. This app is for security guards only.');
    err.status = 403;
    throw err;
  }

  return {
    user: { id: user.id, email: user.email },
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
    profile: {
      first_name: profile.first_name,
      middle_name: profile.middle_name,
      last_name: profile.last_name,
      role: profile.role,
      avatar_url: profile.avatar_url,
      position: emp.position || null,
      employee_id_number: emp.employee_id_number || null,
      hire_date: emp.hire_date || null,
    },
  };
}

async function getMe(accessToken) {
  const { data: { user }, error: userError } =
    await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    const err = new Error('Invalid or expired session');
    err.status = 401;
    throw err;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('first_name, middle_name, last_name, role, avatar_url, status, employees(position, employee_id_number, hire_date)')
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

  if (!MOBILE_ALLOWED_ROLES.includes(profile.role)) {
    const err = new Error('Access denied. This app is for security guards only.');
    err.status = 403;
    throw err;
  }

  const emp = profile.employees?.[0] || profile.employees || {};

  if (emp.position !== 'Security Guard') {
    const err = new Error('Access denied. This app is for security guards only.');
    err.status = 403;
    throw err;
  }

  return {
    user: { id: user.id, email: user.email },
    profile: {
      first_name: profile.first_name,
      middle_name: profile.middle_name,
      last_name: profile.last_name,
      role: profile.role,
      avatar_url: profile.avatar_url,
      position: emp.position || null,
      employee_id_number: emp.employee_id_number || null,
      hire_date: emp.hire_date || null,
    },
  };
}

module.exports = { login, getMe };

