const authService = require('../services/authService');

/**
 * POST /api/web/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * GET /api/web/auth/me
 * Headers: Authorization: Bearer <access_token>
 */
async function me(req, res) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const result = await authService.getMe(token);
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * POST /api/web/auth/logout
 * Headers: Authorization: Bearer <access_token>
 */
async function logout(req, res) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    await authService.logout(token);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

/**
 * Extract Bearer token from the Authorization header.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

module.exports = { login, me, logout };
