const { supabaseAdmin } = require('@src/supabaseClient');

/**
 * Fetch a list of active clients for dropdowns and filters.
 * @returns {Array} List of { id, company }
 */
async function getAllClients() {
  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, company')
    .order('company', { ascending: true });

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  return clients;
}

module.exports = {
  getAllClients
};
