const { supabase, supabaseAdmin } = require('@src/supabaseClient');

/**
 * Middleware: requireAuth
 *
 * Verifies the Bearer token from the Authorization header using Supabase,
 * then fetches the user profile and attaches both to the request object.
 *
 * Sets: req.user, req.profile
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token is required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the access token with Supabase
    const { data: { user }, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch associated profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, role, avatar_url, status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.status !== 'active') {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    // Attach to request for downstream handlers
    req.user = user;
    req.profile = profile;

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware factory: requireRole
 *
 * Returns a middleware that checks whether the authenticated user's role
 * is in the list of allowed roles. Must be used after requireAuth.
 *
 * @param  {...string} roles — allowed roles (e.g. 'admin', 'client')
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.get('/admin-only', requireAuth, requireRole('admin'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        error: 'You do not have permission to access this resource',
      });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
