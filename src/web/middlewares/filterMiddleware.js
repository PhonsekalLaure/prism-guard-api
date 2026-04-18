/**
 * Middleware to parse filtering query parameters
 */
function filterMiddleware(req, res, next) {
  const { search, status, client } = req.query;

  // Standardize the filters object
  req.filters = {
    search: search || null,
    status: status || 'all',
    client: client || 'all'
  };

  next();
}

module.exports = filterMiddleware;
