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
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { redirectTo: 'http://localhost:5173/set-password' }
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
        contact_email: data.email,
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
        rate_per_guard: parsedRatePerGuard,
        billing_type: billingType,
      }]);

    if (clientError) throw clientError;

    if (normalizedSites.length > 0) {
      const siteRows = normalizedSites.map((site) => ({ ...site, client_id: userId }));
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
