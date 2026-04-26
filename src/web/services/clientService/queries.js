const {
  supabaseAdmin,
  getPaginationRange,
} = require('./shared');
const {
  getContractStatus,
  getClientInitials,
} = require('./helpers');

async function getAllClients(page = 1, limit = 6, filters = null) {
  const { from, to } = getPaginationRange(page, limit);

  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      status,
      contact_email,
      phone_number,
      clients!inner (
        company,
        billing_address,
        contract_start_date,
        contract_end_date,
        rate_per_guard,
        billing_type
      )
    `, { count: 'exact' })
    .eq('role', 'client');

  if (filters) {
    if (filters.search) {
      const searchStr = filters.search.trim();
      query = query.ilike('clients.company', `%${searchStr}%`);
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
  }

  const { data: profiles, error, count } = await query.range(from, to);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const profileData = profiles || [];
  const formatted = profileData.map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : (p.clients || {});

    return {
      id: p.id,
      company: client.company || 'N/A',
      contact_person: `${p.first_name} ${p.last_name}`,
      contact_email: p.contact_email,
      phone_number: p.phone_number,
      status: p.status,
      initials: getClientInitials(client.company, p.first_name, p.last_name),
      contract_status: getContractStatus(client.contract_start_date, client.contract_end_date),
      rate_per_guard: client.rate_per_guard,
      billing_type: client.billing_type,
      guard_count: 0,
    };
  });

  return {
    clients: formatted,
    totalCount: count || 0,
  };
}

async function getClientDetails(id) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      middle_name,
      last_name,
      contact_email,
      phone_number,
      status,
      clients (
        id,
        company,
        billing_address,
        contract_start_date,
        contract_end_date,
        rate_per_guard,
        billing_type,
        client_sites (
          id,
          site_name,
          site_address,
          latitude,
          longitude,
          geofence_radius_meters,
          is_active
        ),
        billings (
          id,
          period_start,
          period_end,
          total_amount,
          amount_paid,
          balance_due,
          due_date,
          status,
          payment_date,
          payment_reference
        ),
        service_tickets (
          id,
          ticket_type,
          subject,
          description,
          priority,
          status,
          created_at,
          resolved_at,
          resolution_notes
        )
      )
    `)
    .eq('id', id)
    .eq('role', 'client')
    .single();

  if (error || !profile) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }

  const client = Array.isArray(profile.clients) ? profile.clients[0] : (profile.clients || {});
  const sites = Array.isArray(client.client_sites) ? client.client_sites : (client.client_sites ? [client.client_sites] : []);
  const billings = Array.isArray(client.billings) ? client.billings : (client.billings ? [client.billings] : []);
  const serviceTickets = Array.isArray(client.service_tickets)
    ? client.service_tickets
    : (client.service_tickets ? [client.service_tickets] : []);

  billings.sort((a, b) => new Date(b.period_end) - new Date(a.period_end));
  serviceTickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const siteIds = sites.map((site) => site.id);
  let guardCount = 0;
  const activeGuardCountsBySite = new Map();

  if (siteIds.length > 0) {
    const { data: deployments, error: deploymentsError } = await supabaseAdmin
      .from('deployments')
      .select('id, site_id')
      .in('site_id', siteIds)
      .eq('status', 'active');

    if (deploymentsError) {
      const err = new Error(deploymentsError.message);
      err.status = 500;
      throw err;
    }

    guardCount = deployments?.length || 0;
    for (const deployment of deployments || []) {
      activeGuardCountsBySite.set(
        deployment.site_id,
        (activeGuardCountsBySite.get(deployment.site_id) || 0) + 1
      );
    }
  }

  const enrichedSites = sites.map((site) => ({
    ...site,
    active_guard_count: activeGuardCountsBySite.get(site.id) || 0,
  }));

  return {
    id: profile.id,
    company: client.company,
    contact_person: `${profile.first_name} ${profile.middle_name ? `${profile.middle_name} ` : ''}${profile.last_name}`,
    contact_email: profile.contact_email,
    phone_number: profile.phone_number,
    status: profile.status,
    initials: getClientInitials(client.company, profile.first_name, profile.last_name),
    billing_address: client.billing_address,
    contract_start_date: client.contract_start_date,
    contract_end_date: client.contract_end_date,
    contract_status: getContractStatus(client.contract_start_date, client.contract_end_date),
    rate_per_guard: client.rate_per_guard,
    billing_type: client.billing_type,
    guard_count: guardCount,
    sites: enrichedSites,
    billings,
    service_tickets: serviceTickets,
  };
}

async function getClientStats() {
  const { data: clientProfiles, error: clientError } = await supabaseAdmin
    .from('profiles')
    .select('id, status, clients!inner(contract_start_date, contract_end_date)')
    .eq('role', 'client');

  if (clientError) throw clientError;

  const totalClients = clientProfiles.length;
  const activeContracts = clientProfiles.filter((profile) => {
    const client = Array.isArray(profile.clients) ? profile.clients[0] : profile.clients;
    return getContractStatus(client?.contract_start_date, client?.contract_end_date) === 'Active';
  }).length;

  return {
    totalClients,
    activeContracts,
  };
}

async function getClientsList() {
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

async function getAllSitesList() {
  const { data: sites, error } = await supabaseAdmin
    .from('client_sites')
    .select(`
      id,
      site_name,
      site_address,
      client_id,
      clients ( company )
    `)
    .eq('is_active', true)
    .order('site_name', { ascending: true });

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  return sites;
}

module.exports = {
  getAllClients,
  getClientDetails,
  getClientStats,
  getClientsList,
  getAllSitesList,
};
