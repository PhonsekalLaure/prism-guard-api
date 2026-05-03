const {
  supabaseAdmin,
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
  rollbackProvisionedUser,
} = require('./shared');
const { sendInviteEmail } = require('@services/inviteService');
const {
  normalizeEmailAddress,
  restoreAuthEmail,
  restoreProfileState,
  updateAccountProfileAndAuthEmail,
} = require('../shared/accountIdentity');
const {
  toProperCase,
  normalizeClientSites,
} = require('./helpers');
const employeeService = require('@services/employeeService');

async function createClient(data, actorUserId) {
  const firstName = toProperCase(data.firstName);
  const lastName = toProperCase(data.lastName);
  const middleName = data.middleName ? toProperCase(data.middleName) : null;
  const suffix = data.suffix ? data.suffix.trim() : null;
  const company = toProperCase(data.company);
  const billingType = (data.billingType || 'semi_monthly').toLowerCase();
  const mobile = normalizeMobileNumber(data.mobile, { required: true, fieldLabel: 'Mobile number' });
  const normalizedSites = normalizeClientSites(data.sites);
  const initialDeployment = data.initialDeployment && typeof data.initialDeployment === 'object'
    ? data.initialDeployment
    : null;
  const deploymentAssignments = Array.isArray(initialDeployment?.assignments)
    ? initialDeployment.assignments
    : (Array.isArray(initialDeployment?.employeeIds)
      ? initialDeployment.employeeIds.map((employeeId) => ({
        employeeId,
        baseSalary: initialDeployment.baseSalary,
        contractStartDate: initialDeployment.contractStartDate,
        contractEndDate: initialDeployment.contractEndDate,
        daysOfWeek: initialDeployment.daysOfWeek,
        shiftStart: initialDeployment.shiftStart,
        shiftEnd: initialDeployment.shiftEnd,
        deploymentOrderUrl: initialDeployment.deploymentOrderUrl,
      }))
      : []);

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
  const createdInitialDeployments = [];

  try {
    const email = normalizeEmailAddress(data.email);
    const { data: authData, error: authError } = await sendInviteEmail(email, actorUserId);
    if (authError) throw authError;

    userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        contact_email: email,
        phone_number: mobile,
        role: 'client',
        status: 'active',
        avatar_url: data.avatarUrl || null,
      }]);

    if (profileError) throw profileError;

    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert([{
        id: userId,
        company,
        billing_address: data.billingAddress || null,
        contract_start_date: data.contractStartDate || null,
        contract_end_date: data.contractEndDate || null,
        contract_url: data.contractUrl || null,
        rate_per_guard: parsedRatePerGuard,
        billing_type: billingType,
      }]);

    if (clientError) throw clientError;

    let createdSites = [];
    if (normalizedSites.length > 0) {
      const siteRows = normalizedSites.map((site) => ({ ...site, client_id: userId }));
      const { data: insertedSites, error: sitesError } = await supabaseAdmin
        .from('client_sites')
        .insert(siteRows)
        .select('id, site_name, site_address, latitude, longitude, geofence_radius_meters');
      if (sitesError) throw sitesError;
      createdSites = insertedSites || [];
    }

    if (deploymentAssignments.length > 0) {
      const siteIndex = Number(initialDeployment.siteIndex);
      if (!Number.isInteger(siteIndex) || siteIndex < 0 || siteIndex >= createdSites.length) {
        throw buildBadRequestError('Initial deployment requires a valid selected site.');
      }

      for (const assignment of deploymentAssignments) {
        if (!assignment.deploymentOrderUrl) {
          throw buildBadRequestError('Initial deployment requires a deployment order for each selected guard.');
        }

        const deploymentResult = await employeeService.deployEmployee(assignment.employeeId, {
          siteId: createdSites[siteIndex].id,
          baseSalary: assignment.baseSalary,
          contractStartDate: assignment.contractStartDate || data.contractStartDate || null,
          contractEndDate: assignment.contractEndDate || data.contractEndDate || null,
          daysOfWeek: assignment.daysOfWeek,
          shiftStart: assignment.shiftStart,
          shiftEnd: assignment.shiftEnd,
          deploymentOrderUrl: assignment.deploymentOrderUrl,
        });
        createdInitialDeployments.push({
          employeeId: assignment.employeeId,
          ...deploymentResult,
        });
      }
    }

    return { userId, sites: createdSites };
  } catch (err) {
    for (const deployment of createdInitialDeployments.reverse()) {
      if (deployment.deployment_id) {
        await supabaseAdmin
          .from('deployments')
          .delete()
          .eq('id', deployment.deployment_id);
      }
      if (deployment.previous_base_salary !== undefined) {
        await supabaseAdmin
          .from('employees')
          .update({ base_salary: deployment.previous_base_salary })
          .eq('id', deployment.employeeId);
      }
    }

    if (userId) {
      await rollbackProvisionedUser(supabaseAdmin, userId, 'createClient');
    }
    throw err;
  }
}

async function getExistingClientForUpdate(id) {
  const { data: existingClient, error: existingClientError } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      role,
      first_name,
      middle_name,
      last_name,
      suffix,
      contact_email,
      phone_number,
      status,
      avatar_url,
      clients (
        contract_start_date,
        contract_end_date,
        contract_url,
        company,
        billing_address,
        rate_per_guard,
        billing_type
      )
    `)
    .eq('id', id)
    .single();

  if (existingClientError || !existingClient) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }

  const clientData = Array.isArray(existingClient.clients) ? existingClient.clients[0] : existingClient.clients;

  return {
    profile: existingClient,
    client: clientData || {},
  };
}

function buildClientProfileRollbackState(existingProfile) {
  return {
    first_name: existingProfile.first_name,
    middle_name: existingProfile.middle_name,
    last_name: existingProfile.last_name,
    suffix: existingProfile.suffix,
    contact_email: existingProfile.contact_email,
    phone_number: existingProfile.phone_number,
    status: existingProfile.status,
    avatar_url: existingProfile.avatar_url,
  };
}

function normalizeClientSiteInput(site = {}, options = {}) {
  const { labelPrefix = 'Site' } = options;
  const siteName = (site.siteName || '').trim();
  const normalizedAddress = normalizeAddressWithCoordinates(
    site.siteAddress,
    site.latitude,
    site.longitude,
    {
      addressLabel: `${labelPrefix} address`,
      requireAddress: true,
      requireCoordinates: true,
    }
  );
  const geofenceRadius = Number(site.geofenceRadius);

  if (!siteName) {
    throw buildBadRequestError(`${labelPrefix} name is required.`);
  }

  if (Number.isNaN(geofenceRadius) || geofenceRadius <= 0) {
    throw buildBadRequestError(`${labelPrefix} geofence radius must be a positive number.`);
  }

  return {
    site_name: siteName,
    site_address: normalizedAddress.address,
    latitude: normalizedAddress.latitude,
    longitude: normalizedAddress.longitude,
    geofence_radius_meters: Math.round(geofenceRadius),
  };
}

async function getClientSiteOrThrow(clientId, siteId) {
  const { data, error } = await supabaseAdmin
    .from('client_sites')
    .select('id, client_id, site_name, site_address, latitude, longitude, geofence_radius_meters, is_active')
    .eq('id', siteId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('Client site not found');
    err.status = 404;
    throw err;
  }

  return data;
}

async function updateClient(id, data) {
  const { profile: existingProfile, client: existingClient } = await getExistingClientForUpdate(id);

  const profileUpdates = {};
  if (data.firstName !== undefined) profileUpdates.first_name = data.firstName ? toProperCase(data.firstName) : null;
  if (data.lastName !== undefined) profileUpdates.last_name = data.lastName ? toProperCase(data.lastName) : null;
  if (data.middleName !== undefined) profileUpdates.middle_name = data.middleName ? toProperCase(data.middleName) : null;
  if (data.suffix !== undefined) profileUpdates.suffix = data.suffix;
  if (data.status !== undefined) profileUpdates.status = data.status;
  if (data.mobile !== undefined) {
    profileUpdates.phone_number = normalizeMobileNumber(data.mobile, {
      required: true,
      fieldLabel: 'Mobile number',
    });
  }
  if (data.email !== undefined) profileUpdates.contact_email = normalizeEmailAddress(data.email);
  if (data.avatarUrl !== undefined) profileUpdates.avatar_url = data.avatarUrl || null;

  const clientUpdates = {};
  if (data.company !== undefined) clientUpdates.company = data.company ? toProperCase(data.company) : null;
  if (data.billingAddress !== undefined) clientUpdates.billing_address = data.billingAddress || null;

  const nextContractStartDate = data.contractStartDate !== undefined
    ? (data.contractStartDate || null)
    : existingClient.contract_start_date;
  const nextContractEndDate = data.contractEndDate !== undefined
    ? (data.contractEndDate || null)
    : existingClient.contract_end_date;

  const nextRatePerGuard = data.ratePerGuard === undefined
    ? undefined
    : (data.ratePerGuard === '' ? null : Number(data.ratePerGuard));

  if (nextContractStartDate && nextContractEndDate && new Date(nextContractStartDate) >= new Date(nextContractEndDate)) {
    throw buildBadRequestError('Contract end date must be after start date.');
  }

  if (nextRatePerGuard !== undefined && nextRatePerGuard !== null && Number.isNaN(nextRatePerGuard)) {
    throw buildBadRequestError('Rate per guard must be a valid number.');
  }

  if (data.contractStartDate !== undefined) clientUpdates.contract_start_date = nextContractStartDate;
  if (data.contractEndDate !== undefined) clientUpdates.contract_end_date = nextContractEndDate;
  if (data.contractUrl !== undefined) clientUpdates.contract_url = data.contractUrl || null;
  if (nextRatePerGuard !== undefined) clientUpdates.rate_per_guard = nextRatePerGuard;
  if (data.billingType !== undefined) clientUpdates.billing_type = data.billingType ? data.billingType.toLowerCase() : null;

  let profileUpdated = false;
  let emailChanged = false;
  let clientUpdated = false;

  try {
    if (Object.keys(profileUpdates).length > 0) {
      const profileResult = await updateAccountProfileAndAuthEmail({
        userId: id,
        role: 'client',
        profilePatch: profileUpdates,
        previousProfileState: buildClientProfileRollbackState(existingProfile),
      });
      profileUpdated = profileResult.profileUpdated;
      emailChanged = profileResult.emailChanged;
    }

    if (Object.keys(clientUpdates).length > 0) {
      const { error: clientError } = await supabaseAdmin
        .from('clients')
        .update(clientUpdates)
        .eq('id', id);

      if (clientError) throw clientError;
      clientUpdated = true;
    }
  } catch (error) {
    if (clientUpdated) {
      await supabaseAdmin
        .from('clients')
        .update({
          company: existingClient.company || null,
          billing_address: existingClient.billing_address || null,
          contract_start_date: existingClient.contract_start_date || null,
          contract_end_date: existingClient.contract_end_date || null,
          contract_url: existingClient.contract_url || null,
          rate_per_guard: existingClient.rate_per_guard ?? null,
          billing_type: existingClient.billing_type || null,
        })
        .eq('id', id);
    }

    if (profileUpdated) {
      await restoreProfileState(id, 'client', buildClientProfileRollbackState(existingProfile));
      if (emailChanged) {
        await restoreAuthEmail(id, existingProfile.contact_email);
      }
    }

    throw error;
  }

  return { success: true };
}

async function createClientSite(clientId, data) {
  const clientProfile = await getClientForStatusChange(clientId);
  if (clientProfile.status !== 'active') {
    throw buildBadRequestError('Inactive clients cannot add new sites.');
  }

  const normalizedSite = normalizeClientSiteInput(data, { labelPrefix: 'Site' });

  const { data: site, error } = await supabaseAdmin
    .from('client_sites')
    .insert([{
      client_id: clientId,
      ...normalizedSite,
      is_active: true,
    }])
    .select('id, site_name, site_address, latitude, longitude, geofence_radius_meters, is_active')
    .single();

  if (error) throw error;

  return site;
}

async function updateClientSite(clientId, siteId, data) {
  const clientProfile = await getClientForStatusChange(clientId);
  if (clientProfile.status !== 'active') {
    throw buildBadRequestError('Inactive clients cannot update sites.');
  }

  const existingSite = await getClientSiteOrThrow(clientId, siteId);
  if (!existingSite.is_active) {
    throw buildBadRequestError('Inactive sites cannot be edited.');
  }

  const normalizedSite = normalizeClientSiteInput({
    siteName: data.siteName ?? existingSite.site_name,
    siteAddress: data.siteAddress ?? existingSite.site_address,
    latitude: data.latitude ?? existingSite.latitude,
    longitude: data.longitude ?? existingSite.longitude,
    geofenceRadius: data.geofenceRadius ?? existingSite.geofence_radius_meters,
  }, { labelPrefix: 'Site' });

  const { data: site, error } = await supabaseAdmin
    .from('client_sites')
    .update(normalizedSite)
    .eq('id', siteId)
    .eq('client_id', clientId)
    .select('id, site_name, site_address, latitude, longitude, geofence_radius_meters, is_active')
    .single();

  if (error) throw error;

  return site;
}

async function deactivateClientSite(clientId, siteId) {
  const clientProfile = await getClientForStatusChange(clientId);
  if (clientProfile.status !== 'active') {
    throw buildBadRequestError('Inactive clients cannot deactivate sites.');
  }

  const site = await getClientSiteOrThrow(clientId, siteId);
  if (!site.is_active) {
    throw buildBadRequestError('Client site is already inactive.');
  }

  const { data: activeDeployment, error: activeDeploymentError } = await supabaseAdmin
    .from('deployments')
    .select('id')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (activeDeploymentError) throw activeDeploymentError;
  if (activeDeployment?.id) {
    throw buildBadRequestError('Relieve or transfer all active guards before deactivating this site.');
  }

  const { data: updatedSite, error } = await supabaseAdmin
    .from('client_sites')
    .update({ is_active: false })
    .eq('id', siteId)
    .eq('client_id', clientId)
    .select('id, site_name, site_address, latitude, longitude, geofence_radius_meters, is_active')
    .single();

  if (error) throw error;

  return updatedSite;
}

async function getClientForStatusChange(clientId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('id', clientId)
    .eq('role', 'client')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }

  return data;
}

async function deactivateClient(clientId) {
  const clientProfile = await getClientForStatusChange(clientId);

  if (clientProfile.status === 'inactive') {
    throw buildBadRequestError('Client is already inactive.');
  }

  const { data: clientSites, error: sitesError } = await supabaseAdmin
    .from('client_sites')
    .select('id')
    .eq('client_id', clientId);

  if (sitesError) throw sitesError;

  const siteIds = (clientSites || []).map((site) => site.id);

  if (siteIds.length > 0) {
    const { data: activeDeployment, error: deploymentError } = await supabaseAdmin
      .from('deployments')
      .select('id')
      .in('site_id', siteIds)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (deploymentError) throw deploymentError;

    if (activeDeployment?.id) {
      throw buildBadRequestError('Relieve or transfer all active guards before deactivating this client.');
    }
  }

  const deletedAt = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      status: 'inactive',
      deleted_at: deletedAt,
    })
    .eq('id', clientId)
    .eq('role', 'client');

  if (profileError) throw profileError;

  if (siteIds.length > 0) {
    const { error: siteUpdateError } = await supabaseAdmin
      .from('client_sites')
      .update({ is_active: false })
      .eq('client_id', clientId)
      .eq('is_active', true);

    if (siteUpdateError) {
      await supabaseAdmin
        .from('profiles')
        .update({
          status: clientProfile.status,
          deleted_at: null,
        })
        .eq('id', clientId)
        .eq('role', 'client');
      throw siteUpdateError;
    }
  }

  return {
    success: true,
    client_id: clientId,
    status: 'inactive',
    deleted_at: deletedAt,
    deactivated_site_count: siteIds.length,
  };
}

async function relieveAllClientGuards(clientId, options = {}) {
  await getClientForStatusChange(clientId);

  const reliefDate = options.reliefDate || null;

  const { data: clientSites, error: sitesError } = await supabaseAdmin
    .from('client_sites')
    .select('id')
    .eq('client_id', clientId)
    .eq('is_active', true);

  if (sitesError) throw sitesError;

  const siteIds = (clientSites || []).map((site) => site.id);
  if (siteIds.length === 0) {
    throw buildBadRequestError('Client does not have any active sites to relieve guards from.');
  }

  const { data: deployments, error: deploymentsError } = await supabaseAdmin
    .from('deployments')
    .select('employee_id, site_id, start_date')
    .in('site_id', siteIds)
    .eq('status', 'active')
    .order('start_date', { ascending: false });

  if (deploymentsError) throw deploymentsError;

  const activeDeployments = deployments || [];
  if (activeDeployments.length === 0) {
    throw buildBadRequestError('No active guards are currently deployed to this client.');
  }

  const relievedEmployeeIds = [];

  for (const deployment of activeDeployments) {
    try {
      await employeeService.relieveEmployeeAssignment(deployment.employee_id, { reliefDate });
      relievedEmployeeIds.push(deployment.employee_id);
    } catch (err) {
      if (relievedEmployeeIds.length > 0) {
        err.message = `Relieved ${relievedEmployeeIds.length} guard(s) before failure. ${err.message}`;
      }
      throw err;
    }
  }

  return {
    success: true,
    client_id: clientId,
    relieved_guard_count: relievedEmployeeIds.length,
    relieved_employee_ids: relievedEmployeeIds,
  };
}

module.exports = {
  createClient,
  updateClient,
  createClientSite,
  updateClientSite,
  deactivateClientSite,
  deactivateClient,
  relieveAllClientGuards,
};
