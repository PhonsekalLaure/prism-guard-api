/**
 * Middleware to parse filtering query parameters
 */
function filterMiddleware(req, res, next) {
  const { search, status, client, shift } = req.query;

  // Standardize the filters object
  req.filters = {
    search: search || null,
    status: status || 'all',
    client: client || 'all',
    shift: shift || 'all',
  };

  next();
}

module.exports = filterMiddleware;
