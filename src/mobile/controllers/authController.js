const authService = require('../services/authService');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    return res.json(result);
  } catch (err) {
    console.log('Mobile login error:', err.message); // ADD THIS
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}

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

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

module.exports = { login, me };