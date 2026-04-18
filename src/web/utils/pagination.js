/**
 * Reusable Pagination Utilities
 */

/**
 * Calculate the range for Supabase .range()
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} { from, to }
 */
function getPaginationRange(page, limit) {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 10;
  
  const from = (p - 1) * l;
  const to = from + l - 1;
  
  return { from, to };
}

/**
 * Standardize the paginated response
 * @param {Array} data - The array of items
 * @param {number} count - Total items in database
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} The formatted response { data, metadata }
 */
function formatPaginatedResponse(data, count, page, limit) {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 10;
  
  return {
    data: data || [],
    metadata: {
      total: count || 0,
      page: p,
      limit: l,
      totalPages: Math.ceil((count || 0) / l)
    }
  };
}

module.exports = {
  getPaginationRange,
  formatPaginatedResponse
};
