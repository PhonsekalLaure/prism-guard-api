/**
 * Supabase Filter Utilities
 */

/**
 * Apply a set of filters to a Supabase query builder.
 * Supporting common HRIS filters like name search, status, and client.
 * 
 * @param {Object} query - The Supabase query object
 * @param {Object} filters - Filter key-values
 * @returns {Object} The modified query object
 */
function applySupabaseFilters(query, filters) {
  if (!filters) return query;

  let q = query;

  // 1. Search (Name logic)
  if (filters.search) {
    const searchStr = filters.search.trim();
    // Search across first_name OR last_name
    // Note: For complex cross-table OR, sometimes .or() is used,
    // but here we are on the profiles table primarily.
    q = q.or(`first_name.ilike.%${searchStr}%,last_name.ilike.%${searchStr}%`);
  }

  // 2. Status
  if (filters.status && filters.status !== 'all') {
    q = q.eq('status', filters.status);
  }

  // 3. Client Filter
  // Note: Filtering on nested relations (deployments -> client_sites -> clients)
  // requires the "!inner" hint in the .select() string of the main query.
  // We handle the select string modification in the service layer.
  if (filters.client && filters.client !== 'all' && filters.client !== 'unassigned') {
    q = q.eq('employees.deployments.client_sites.client_id', filters.client);
  }

  // 4. Unassigned Filter
  if (filters.client === 'unassigned') {
    q = q.is('employees.deployments', null);
  }

  return q;
}

/**
 * Check if the client filter is active and not 'all'.
 */
function isClientFilterActive(filters) {
  return filters && filters.client && filters.client !== 'all' && filters.client !== 'unassigned';
}

module.exports = {
  applySupabaseFilters,
  isClientFilterActive
};
