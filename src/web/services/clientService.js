const { supabaseAdmin } = require('@src/supabaseClient');
const { getPaginationRange } = require('@utils/pagination');
const {
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
} = require('@utils/requestValidation');
const { rollbackProvisionedUser } = require('@utils/userProvisioning');

/**
 * Fetch a paginated list of clients with optional filters.
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @param {Object} filters - Search and status filters
 * @returns {Object} { clients: Array, totalCount: number }
 */
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

  // Apply filters
  if (filters) {
    // Search on company
    if (filters.search) {
      const searchStr = filters.search.trim();
      query = query.ilike('clients.company', `%${searchStr}%`);
    }

    // Status filter
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
  const formatted = profileData.map(p => {
    const client = Array.isArray(p.clients) ? p.clients[0] : (p.clients || {});
    
    // Calculate contract status
    let contractStatus = 'No Contract';
    if (client.contract_start_date && client.contract_end_date) {
      const now = new Date();
      const start = new Date(client.contract_start_date);
      const end = new Date(client.contract_end_date);
      if (now < start) {
        contractStatus = 'Upcoming';
      } else if (now > end) {
        contractStatus = 'Expired';
      } else {
        contractStatus = 'Active';
      }
    }

    // Generate initials from company name or contact person
    let initials = '??';
    if (client.company && client.company !== 'N/A') {
      initials = client.company.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    } else {
      initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
    }

    // Calculate guard count (simplified for list view - you might want to optimize this later)
    // For now, we'll return N/A or 0 if we don't have the relation joined. 
    // To keep it simple and fast for the grid, we can just return 0 for now or add a join.
    // Let's add a join to get the count of deployments through sites.
    
    return {
      id: p.id,
      company: client.company || 'N/A',
      contact_person: `${p.first_name} ${p.last_name}`,
      contact_email: p.contact_email,
      phone_number: p.phone_number,
      status: p.status,
      initials: initials,
      contract_status: contractStatus,
      rate_per_guard: client.rate_per_guard,
      billing_type: client.billing_type,
      guard_count: 0 // Will implement full count in details view first
    };
  });

  return {
    clients: formatted,
    totalCount: count || 0
  };
}

/**
 * Fetch detailed information for a specific client.
 * @param {string} id - The UUID of the client matching their profile ID
 * @returns {Object} Detailed client data
 */
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

  // Prepare arrays from nested client object
  const sites = Array.isArray(client.client_sites) ? client.client_sites : (client.client_sites ? [client.client_sites] : []);
  const billings = Array.isArray(client.billings) ? client.billings : (client.billings ? [client.billings] : []);
  const serviceTickets = Array.isArray(client.service_tickets) ? client.service_tickets : (client.service_tickets ? [client.service_tickets] : []);

  // Sort billings by period end descending
  billings.sort((a, b) => new Date(b.period_end) - new Date(a.period_end));

  // Sort service tickets by created_at descending
  serviceTickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Calculate contract status
  let contractStatus = 'No Contract';
  if (client.contract_start_date && client.contract_end_date) {
    const now = new Date();
    const start = new Date(client.contract_start_date);
    const end = new Date(client.contract_end_date);
    if (now < start) {
      contractStatus = 'Upcoming';
    } else if (now > end) {
      contractStatus = 'Expired';
    } else {
      contractStatus = 'Active';
    }
  }

    // 4. Calculate Guard Count
    // We count all active deployments linked to this client's sites
    const siteIds = sites.map(s => s.id);
    let guardCount = 0;
    
    if (siteIds.length > 0) {
      const { count, error: countError } = await supabaseAdmin
        .from('deployments')
        .select('*', { count: 'exact', head: true })
        .in('site_id', siteIds)
        .eq('status', 'active');
      
      if (!countError) guardCount = count || 0;
    }

    // Generate initials
    let initials = '??';
    if (client.company) {
      initials = client.company.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    } else {
      initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }

    return {
      id: profile.id,
      company: client.company,
      contact_person: `${profile.first_name} ${profile.middle_name ? profile.middle_name + ' ' : ''}${profile.last_name}`,
      contact_email: profile.contact_email,
      phone_number: profile.phone_number,
      status: profile.status,
      initials: initials,
      
      // Contract details
      billing_address: client.billing_address,
      contract_start_date: client.contract_start_date,
      contract_end_date: client.contract_end_date,
      contract_status: contractStatus,
      rate_per_guard: client.rate_per_guard,
      billing_type: client.billing_type,
      guard_count: guardCount,

      // Relations
      sites: sites,
      billings: billings,
      service_tickets: serviceTickets
    };
}

/**
 * Fetch statistics for the Clients Dashboard
 * @returns {Object} Stats: totalClients, activeContracts
 */
async function getClientStats() {
  // 1. Get client counts
  const { data: clientProfiles, error: clientError } = await supabaseAdmin
    .from('profiles')
    .select('id, status, clients!inner(contract_start_date, contract_end_date)')
    .eq('role', 'client');

  if (clientError) throw clientError;

  const totalClients = clientProfiles.length;

  // Calculate active contracts
  const now = new Date();
  const activeContracts = clientProfiles.filter(p => {
    // clientProfiles joins 'clients' as an array or object depending on !inner and postgrest version
    // but usually an array for joins.
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    if (!client || !client.contract_start_date || !client.contract_end_date) return false;
    const start = new Date(client.contract_start_date);
    const end = new Date(client.contract_end_date);
    return now >= start && now <= end;
  }).length;

  return {
    totalClients: totalClients,
    activeContracts: activeContracts
  };
}

/**
 * Helper to convert strings to Proper Case (Capitalized First Letter of Each Word)
 */
function toProperCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

function normalizeClientSites(rawSites) {
  if (!rawSites) return [];
  if (!Array.isArray(rawSites)) {
    throw buildBadRequestError('Sites must be an array.');
  }

  const rows = [];

  rawSites.forEach((site, index) => {
    if (!site || typeof site !== 'object') {
      throw buildBadRequestError(`Site ${index + 1} is invalid.`);
    }

    const siteName = (site.siteName || '').trim();
    const siteAddress = (site.siteAddress || '').trim();
    const hasLatitude = site.latitude !== '' && site.latitude !== null && site.latitude !== undefined;
    const hasLongitude = site.longitude !== '' && site.longitude !== null && site.longitude !== undefined;
    const hasRadius = site.geofenceRadius !== '' && site.geofenceRadius !== null && site.geofenceRadius !== undefined;

    const hasAnyValue = siteName || siteAddress || hasLatitude || hasLongitude || hasRadius;
    if (!hasAnyValue) return;

    if (!siteName || !siteAddress || !hasLatitude || !hasLongitude) {
      throw buildBadRequestError(
        `Site ${index + 1} is incomplete. Site name, address, latitude, and longitude are required.`
      );
    }

    const normalizedAddress = normalizeAddressWithCoordinates(
      siteAddress,
      site.latitude,
      site.longitude,
      {
        addressLabel: `Site ${index + 1} address`,
        requireAddress: true,
        requireCoordinates: true,
      }
    );

    const geofenceRadius = hasRadius ? Number(site.geofenceRadius) : 50;

    if (Number.isNaN(geofenceRadius) || geofenceRadius <= 0) {
      throw buildBadRequestError(`Site ${index + 1} has an invalid geofence radius.`);
    }

    rows.push({
      site_name: siteName,
      site_address: normalizedAddress.address,
      latitude: normalizedAddress.latitude,
      longitude: normalizedAddress.longitude,
      geofence_radius_meters: Math.round(geofenceRadius),
    });
  });

  return rows;
}

/**
 * Creates a new client user, profile, and client details.
 */
async function createClient(data) {
  const firstName = toProperCase(data.firstName);
  const lastName = toProperCase(data.lastName);
  const middleName = data.middleName ? toProperCase(data.middleName) : null;
  const suffix = data.suffix ? data.suffix.trim() : null;
  const company = toProperCase(data.company);
  const billingType = (data.billingType || 'semi_monthly').toLowerCase();
  const mobile = normalizeMobileNumber(data.mobile, { required: true, fieldLabel: 'Mobile number' });
  const normalizedSites = normalizeClientSites(data.sites);

  const allowedBillingTypes = new Set(['semi_monthly', 'monthly', 'weekly']);
  if (!allowedBillingTypes.has(billingType)) {
    throw buildBadRequestError('Invalid billing type.');
  }

  const parsedRatePerGuard = data.ratePerGuard === '' || data.ratePerGuard === null || data.ratePerGuard === undefined
    ? null
    : Number(data.ratePerGuard);

  if (parsedRatePerGuard !== null && Number.isNaN(parsedRatePerGuard)) {
    throw buildBadRequestError('Rate per guard must be a valid number.');
  }

  if (data.contractStartDate && data.contractEndDate) {
    const start = new Date(data.contractStartDate);
    const end = new Date(data.contractEndDate);
    if (start >= end) {
      throw buildBadRequestError('Contract end date must be after start date.');
    }
  }

  let userId = null;

  try {
    // 1. Invite auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { redirectTo: 'http://localhost:5173/set-password' }
    );
    if (authError) throw authError;

    userId = authData.user.id;

    // 2. Insert into profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        contact_email: data.email,
        phone_number: mobile,
        role: 'client',
        status: 'active'
      }]);

    if (profileError) throw profileError;

    // 3. Insert into clients
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert([{
        id: userId,
        company,
        billing_address: data.billingAddress || null,
        contract_start_date: data.contractStartDate || null,
        contract_end_date: data.contractEndDate || null,
        rate_per_guard: parsedRatePerGuard,
        billing_type: billingType
      }]);

    if (clientError) throw clientError;

    // 4. Insert client sites (optional)
    if (normalizedSites.length > 0) {
      const siteRows = normalizedSites.map(site => ({ ...site, client_id: userId }));
      const { error: sitesError } = await supabaseAdmin.from('client_sites').insert(siteRows);
      if (sitesError) throw sitesError;
    }

    return { userId };
  } catch (err) {
    if (userId) {
      await rollbackProvisionedUser(supabaseAdmin, userId, 'createClient');
    }
    throw err;
  }
}

/**
 * Updates an existing client's profile and client details.
 */
async function updateClient(id, data) {
  // 1. Prepare profile update data
  const profileUpdates = {};
  if (data.firstName) profileUpdates.first_name = toProperCase(data.firstName);
  if (data.lastName)  profileUpdates.last_name = toProperCase(data.lastName);
  if (data.middleName !== undefined) profileUpdates.middle_name = data.middleName ? toProperCase(data.middleName) : null;
  if (data.suffix !== undefined) profileUpdates.suffix = data.suffix;
  if (data.status) profileUpdates.status = data.status;
  if (data.mobile !== undefined) {
    profileUpdates.phone_number = normalizeMobileNumber(data.mobile, {
      required: true,
      fieldLabel: 'Mobile number',
    });
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (profileError) throw profileError;
  }

  // 2. Prepare client details update data
  const clientUpdates = {};
  if (data.company) clientUpdates.company = toProperCase(data.company);
  if (data.billingAddress) clientUpdates.billing_address = data.billingAddress;
  if (data.contractStartDate) clientUpdates.contract_start_date = data.contractStartDate;
  if (data.contractEndDate) clientUpdates.contract_end_date = data.contractEndDate;
  if (data.ratePerGuard !== undefined) clientUpdates.rate_per_guard = data.ratePerGuard ? parseFloat(data.ratePerGuard) : null;
  if (data.billingType) clientUpdates.billing_type = data.billingType.toLowerCase();

  if (Object.keys(clientUpdates).length > 0) {
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .update(clientUpdates)
      .eq('id', id);

    if (clientError) throw clientError;
  }

  return { success: true };
}

/**
 * Fetch a list of active clients for dropdowns and filters.
 * @returns {Array} List of { id, company }
 */
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

module.exports = {
  getAllClients,
  getClientDetails,
  getClientStats,
  getClientsList,
  createClient,
  updateClient
};
