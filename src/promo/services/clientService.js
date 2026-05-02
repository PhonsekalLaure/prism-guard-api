const { supabaseAdmin } = require('@src/supabaseClient');

function getContractStatus(contractStartDate, contractEndDate) {
  if (!contractStartDate || !contractEndDate) {
    return 'No Contract';
  }

  const now = new Date();
  const start = new Date(contractStartDate);
  const end = new Date(contractEndDate);

  if (now < start) {
    return 'Upcoming';
  }

  if (now > end) {
    return 'Expired';
  }

  return 'Active';
}

function getClientInitials(company = '') {
  return company
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function normalizeLimit(value) {
  const parsed = parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return 50;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

async function getPromoClients(options = {}) {
  const limit = normalizeLimit(options.limit);

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      status,
      avatar_url,
      clients!inner (
        company,
        contract_start_date,
        contract_end_date,
        client_sites (
          id,
          site_name,
          is_active
        )
      )
    `)
    .eq('role', 'client')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
    .limit(limit);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  return (profiles || [])
    .map((profile) => {
      const client = Array.isArray(profile.clients)
        ? profile.clients[0]
        : (profile.clients || {});
      const sites = Array.isArray(client.client_sites)
        ? client.client_sites
        : (client.client_sites ? [client.client_sites] : []);
      const activeSites = sites.filter((site) => site.is_active);

      return {
        id: profile.id,
        company: client.company,
        initials: getClientInitials(client.company),
        logo_url: profile.avatar_url || null,
        contract_status: getContractStatus(client.contract_start_date, client.contract_end_date),
        site_count: sites.length,
        active_site_count: activeSites.length,
        sites: activeSites.map((site) => ({
          id: site.id,
          site_name: site.site_name,
        })),
      };
    })
    .filter((client) => client.company)
    .sort((a, b) => a.company.localeCompare(b.company));
}

module.exports = {
  getPromoClients,
};
