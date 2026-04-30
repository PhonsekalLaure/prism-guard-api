const {
  supabaseAdmin,
  buildBadRequestError,
  normalizeMobileNumber,
  rollbackProvisionedUser,
} = require('./shared');
const {
  toProperCase,
  normalizeClientSites,
} = require('./helpers');
const employeeService = require('@services/employeeService');

async function createClient(data) {
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
    const email = data.email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { 
        redirectTo: 'http://localhost:5173/set-password',
        data: {
          must_change_password: true,
        }
      }
    );
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
        const deploymentResult = await employeeService.deployEmployee(assignment.employeeId, {
          siteId: createdSites[siteIndex].id,
          baseSalary: assignment.baseSalary,
          contractStartDate: assignment.contractStartDate || data.contractStartDate || null,
          contractEndDate: assignment.contractEndDate || data.contractEndDate || null,
          daysOfWeek: assignment.daysOfWeek,
          shiftStart: assignment.shiftStart,
          shiftEnd: assignment.shiftEnd,
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
      if (deployment.contract_id) {
        await supabaseAdmin
          .from('employee_contracts')
          .delete()
          .eq('id', deployment.contract_id);
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

async function updateClient(id, data) {
  const { data: existingClient, error: existingClientError } = await supabaseAdmin
    .from('clients')
    .select('contract_start_date, contract_end_date')
    .eq('id', id)
    .single();

  if (existingClientError || !existingClient) {
    const err = new Error('Client not found');
    err.status = 404;
    throw err;
  }

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

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (profileError) throw profileError;
  }

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

  if (Object.keys(clientUpdates).length > 0) {
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .update(clientUpdates)
      .eq('id', id);

    if (clientError) throw clientError;
  }

  return { success: true };
}

module.exports = {
  createClient,
  updateClient,
};
