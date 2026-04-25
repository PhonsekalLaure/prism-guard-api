const { supabaseAdmin } = require('@src/supabaseClient');
const { getPaginationRange } = require('@utils/pagination');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveShiftLabel(schedules = []) {
  const active = schedules.find(s => s.is_active !== false);
  if (!active) return 'Unscheduled';

  const { shift_start, shift_end } = active;
  const fmt = (t = '') => t.slice(0, 5);
  const start = fmt(shift_start);
  const end = fmt(shift_end);

  if (start === '06:00' && end === '18:00') return 'Day (6AM-6PM)';
  if (start === '18:00' && end === '06:00') return 'Night (6PM-6AM)';
  if (start === '00:00' && end === '00:00') return '24-Hour';
  return `${start} – ${end}`;
}

function shiftKey(label = '') {
  if (label.startsWith('Day')) return 'day';
  if (label.startsWith('Night')) return 'night';
  if (label === '24-Hour') return '24hr';
  return null;
}

function formatSinceDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return `Since ${d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
}

/**
 * Resolve the site IDs that belong to a given client.
 * Used to scope queries when callerRole === 'client'.
 * @param {string} clientId
 * @returns {string[]} Array of site UUIDs
 */
async function getClientSiteIds(clientId) {
  const { data, error } = await supabaseAdmin
    .from('client_sites')
    .select('id')
    .eq('client_id', clientId);

  if (error) throw error;
  return (data || []).map(s => s.id);
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of deployed guards.
 *
 * When callerRole === 'client', the query is scoped to that client's sites.
 *
 * @param {number}  page
 * @param {number}  limit
 * @param {Object}  filters     – { search, status, shift }
 * @param {string}  callerId    – profile UUID of the requester
 * @param {string}  callerRole  – 'admin' | 'client'
 * @returns {{ guards: Array, totalCount: number }}
 */
async function getAllDeployedGuards(page = 1, limit = 6, filters = {}, callerId, callerRole) {
  const { from, to } = getPaginationRange(page, limit);

  let query = supabaseAdmin
    .from('deployments')
    .select(`
      id,
      status,
      start_date,
      end_date,
      deployment_type,
      employee_id,
      employees!deployments_employee_id_fkey (
        id,
        employee_id_number,
        position,
        hire_date,
        profiles (
          id,
          first_name,
          last_name,
          status,
          avatar_url
        )
      ),
      client_sites!inner (
        id,
        site_name,
        site_address,
        clients!inner (
          id,
          company
        )
      ),
      schedules!schedules_deployment_id_fkey (
        id,
        days_of_week,
        shift_start,
        shift_end,
        is_active
      )
    `, { count: 'exact' })
    .eq('status', 'active');

  // ── Client scoping ──────────────────────────────────────────────────────────
  // When accessed by a client user, restrict to their own sites only.
  if (callerRole === 'client' && callerId) {
    const siteIds = await getClientSiteIds(callerId);
    if (siteIds.length === 0) {
      // Client has no sites → return empty result immediately
      return { guards: [], totalCount: 0 };
    }
    query = query.in('site_id', siteIds);
  }

  const { data: deployments, error, count } = await query.range(from, to);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const raw = deployments || [];

  let formatted = raw.map(d => {
    const emp = Array.isArray(d.employees) ? d.employees[0] : (d.employees || {});
    const profile = Array.isArray(emp.profiles) ? emp.profiles[0] : (emp.profiles || {});
    const site = Array.isArray(d.client_sites) ? d.client_sites[0] : (d.client_sites || {});
    const schedules = Array.isArray(d.schedules) ? d.schedules : (d.schedules ? [d.schedules] : []);

    const shiftLabel = deriveShiftLabel(schedules);
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();

    // Post-fetch search filter
    if (filters.search) {
      const s = filters.search.trim().toLowerCase();
      const matchesName = fullName.toLowerCase().includes(s);
      const matchesId = (emp.employee_id_number || '').toLowerCase().includes(s);
      if (!matchesName && !matchesId) return null;
    }

    // Post-fetch status filter (profile status = employment status)
    if (filters.status && filters.status !== 'all') {
      if ((profile.status || 'active') !== filters.status) return null;
    }

    return {
      id: d.id,
      employee_id: d.employee_id,
      employee_id_number: emp.employee_id_number || 'N/A',
      name: fullName,
      initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase(),
      avatar_url: profile.avatar_url || null,
      status: profile.status || 'active',
      position: emp.position || 'N/A',
      hire_date: emp.hire_date || null,
      since: formatSinceDate(d.start_date),
      shift: shiftLabel,
      shift_key: shiftKey(shiftLabel),
      site_name: site.site_name || 'N/A',
      site_address: site.site_address || 'N/A',
      company: site.clients?.company || 'N/A',
      deployment_type: d.deployment_type || 'regular',
      start_date: d.start_date,
      end_date: d.end_date || null,
    };
  }).filter(Boolean);

  // Post-fetch shift filter
  if (filters.shift && filters.shift !== 'all') {
    formatted = formatted.filter(g => g.shift_key === filters.shift);
  }

  const isFiltered =
    filters.search ||
    (filters.status && filters.status !== 'all') ||
    (filters.shift && filters.shift !== 'all');

  return {
    guards: formatted,
    totalCount: isFiltered ? formatted.length : (count || 0),
  };
}

/**
 * Fetch detailed information for a single deployed guard by deployment ID.
 *
 * @param {string} deploymentId
 * @returns {Object}
 */
async function getDeployedGuardDetails(deploymentId) {
  const { data: deployment, error } = await supabaseAdmin
    .from('deployments')
    .select(`
      id,
      status,
      start_date,
      end_date,
      deployment_type,
      deployment_order_url,
      employee_id,
      employees!deployments_employee_id_fkey (
        id,
        employee_id_number,
        position,
        hire_date,
        date_of_birth,
        gender,
        civil_status,
        citizenship,
        height_cm,
        educational_level,
        residential_address,
        employment_type,
        emergency_contact_name,
        emergency_contact_number,
        profiles (
          id,
          first_name,
          middle_name,
          last_name,
          contact_email,
          phone_number,
          status,
          avatar_url
        ),
        clearances (
          id,
          clearance_type,
          document_url,
          issue_date,
          expiry_date,
          status
        )
      ),
      client_sites (
        id,
        site_name,
        site_address,
        clients (
          id,
          company
        )
      ),
      schedules!schedules_deployment_id_fkey (
        id,
        days_of_week,
        shift_start,
        shift_end,
        is_active
      )
    `)
    .eq('id', deploymentId)
    .single();

  if (error || !deployment) {
    const err = new Error('Deployed guard not found');
    err.status = 404;
    throw err;
  }

  const emp = Array.isArray(deployment.employees)
    ? deployment.employees[0]
    : (deployment.employees || {});
  const profile = Array.isArray(emp.profiles)
    ? emp.profiles[0]
    : (emp.profiles || {});
  const site = Array.isArray(deployment.client_sites)
    ? deployment.client_sites[0]
    : (deployment.client_sites || {});
  const schedules = Array.isArray(deployment.schedules)
    ? deployment.schedules
    : (deployment.schedules ? [deployment.schedules] : []);
  const clearances = Array.isArray(emp.clearances)
    ? emp.clearances
    : (emp.clearances ? [emp.clearances] : []);

  let age = null;
  if (emp.date_of_birth) {
    const diff = new Date() - new Date(emp.date_of_birth);
    age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }

  const shiftLabel = deriveShiftLabel(schedules);

  return {
    deployment_id: deployment.id,
    deployment_status: deployment.status,
    deployment_type: deployment.deployment_type,
    deployment_order_url: deployment.deployment_order_url || null,
    start_date: deployment.start_date,
    end_date: deployment.end_date || null,
    shift: shiftLabel,
    schedules: schedules,

    employee_id: deployment.employee_id,
    employee_id_number: emp.employee_id_number || 'N/A',
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    full_name: `${profile.first_name || ''} ${profile.middle_name ? profile.middle_name + ' ' : ''}${profile.last_name || ''}`.trim(),
    initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase(),
    avatar_url: profile.avatar_url || null,
    status: profile.status || 'active',
    contact_email: profile.contact_email || null,
    phone_number: profile.phone_number || null,

    date_of_birth: emp.date_of_birth || null,
    age: age,
    gender: emp.gender || null,
    civil_status: emp.civil_status || null,
    citizenship: emp.citizenship || null,
    height_cm: emp.height_cm || null,
    educational_level: emp.educational_level || null,
    residential_address: emp.residential_address || null,
    emergency_contact_name: emp.emergency_contact_name || null,
    emergency_contact_number: emp.emergency_contact_number || null,

    position: emp.position || 'N/A',
    hire_date: emp.hire_date || null,
    employment_type: emp.employment_type || null,

    site_id: site.id || null,
    site_name: site.site_name || 'N/A',
    site_address: site.site_address || 'N/A',
    company: site.clients?.company || 'N/A',

    clearances: clearances,
  };
}

/**
 * Fetch summary statistics for the Deployed Guards dashboard.
 *
 * When callerRole === 'client', counts are scoped to that client's sites only.
 *
 * @param {string} callerId
 * @param {string} callerRole
 * @returns {{ totalDeployed, onDuty, onLeave, tempReplaced }}
 */
async function getDeployedGuardsStats(callerId, callerRole) {
  // Resolve the site scope (null = all sites, for admin)
  let siteIds = null;
  if (callerRole === 'client' && callerId) {
    siteIds = await getClientSiteIds(callerId);
    if (siteIds.length === 0) {
      return { totalDeployed: 0, onDuty: 0, onLeave: 0, tempReplaced: 0 };
    }
  }

  // ── 1. Total active deployments ──────────────────────────────────────────
  let totalQuery = supabaseAdmin
    .from('deployments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (siteIds) totalQuery = totalQuery.in('site_id', siteIds);

  const { count: totalDeployed, error: totalError } = await totalQuery;
  if (totalError) throw totalError;

  // ── 2. Profile statuses for deployed guards ──────────────────────────────
  let profileQuery = supabaseAdmin
    .from('deployments')
    .select(`
      employee_id,
      employees!deployments_employee_id_fkey (
        profiles (
          status
        )
      )
    `)
    .eq('status', 'active');
  if (siteIds) profileQuery = profileQuery.in('site_id', siteIds);

  const { data: deployedRows, error: profileError } = await profileQuery;
  if (profileError) throw profileError;

  const statuses = (deployedRows || []).map(d => {
    const emp = Array.isArray(d.employees) ? d.employees[0] : (d.employees || {});
    const profile = Array.isArray(emp.profiles) ? emp.profiles[0] : (emp.profiles || {});
    return profile.status || 'active';
  });

  const onDuty = statuses.filter(s => s === 'active').length;
  const onLeave = statuses.filter(s => s === 'on-leave').length;

  // ── 3. Temporary replacements ─────────────────────────────────────────────
  let replacedQuery = supabaseAdmin
    .from('deployments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('deployment_type', 'reliever');
  if (siteIds) replacedQuery = replacedQuery.in('site_id', siteIds);

  const { count: tempReplaced, error: replacedError } = await replacedQuery;
  if (replacedError) throw replacedError;

  return {
    totalDeployed: totalDeployed || 0,
    onDuty: onDuty,
    onLeave: onLeave,
    tempReplaced: tempReplaced || 0,
  };
}

module.exports = {
  getAllDeployedGuards,
  getDeployedGuardDetails,
  getDeployedGuardsStats,
};
