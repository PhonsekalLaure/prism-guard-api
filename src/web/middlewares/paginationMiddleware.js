/**
 * Middleware to parse pagination query parameters
 */
function paginationMiddleware(defaultLimit = 6) {
  return (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || defaultLimit;

    // Attach to request object for use in controllers
    req.pagination = { 
      page, 
      limit 
    };

    next();
  };
}

module.exports = paginationMiddleware;
