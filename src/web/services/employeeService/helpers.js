const {
  supabaseAdmin,
  buildBadRequestError,
} = require('./shared');

function toProperCase(str, fieldLabel = 'Value') {
  if (!str) return str;
  if (typeof str !== 'string') {
    throw buildBadRequestError(`${fieldLabel} must be a text value.`);
  }
  return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
}

const CLEARANCE_EXPIRY_YEARS = {
  barangay: 1,
  police: 1,
  nbi: 1,
  neuro: 1,
  drugtest: 1,
  sg_license: 2,
  valid_id: null,
  personal_information_sheet: null,
  resume: null,
};

const EMPLOYMENT_CONTRACT_EXPIRY_WARNING_DAYS = 30;

function normalizeDateOnly(value, fieldLabel) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw buildBadRequestError(`${fieldLabel} is invalid.`);
  }

  return value;
}

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function compareDateOnly(left, right) {
  if (!left || !right) return 0;
  return String(left).localeCompare(String(right));
}

function addDaysToDateString(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function normalizeDateRange(startDate, endDate, options = {}) {
  const {
    startLabel = 'Start date',
    endLabel = 'End date',
    fallbackStartDate = null,
  } = options;
  const normalizedStartDate = startDate || fallbackStartDate || new Date().toISOString().split('T')[0];
  let normalizedEndDate = endDate || null;

  normalizeDateOnly(normalizedStartDate, startLabel);

  if (!normalizedEndDate) {
    const defaultEndDate = new Date(normalizedStartDate);
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    normalizedEndDate = defaultEndDate.toISOString().split('T')[0];
  }

  normalizeDateOnly(normalizedEndDate, endLabel);

  if (new Date(normalizedEndDate) < new Date(normalizedStartDate)) {
    throw buildBadRequestError(`${endLabel} cannot be earlier than ${startLabel.toLowerCase()}.`);
  }

  return {
    contractStartDate: normalizedStartDate,
    contractEndDate: normalizedEndDate,
  };
}

function validateDateIsTodayOrLater(value, fieldLabel) {
  if (!value) return null;

  const normalizedValue = normalizeDateOnly(value, fieldLabel);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsedValue = new Date(normalizedValue);
  parsedValue.setHours(0, 0, 0, 0);

  if (parsedValue < today) {
    throw buildBadRequestError(`${fieldLabel} cannot be earlier than today.`);
  }

  return normalizedValue;
}

function normalizeSchedule(schedule = {}) {
  const rawDays = Array.isArray(schedule.daysOfWeek)
    ? schedule.daysOfWeek
    : (schedule.daysOfWeek !== undefined && schedule.daysOfWeek !== null && schedule.daysOfWeek !== ''
      ? [schedule.daysOfWeek]
      : []);
  const daysOfWeek = [...new Set(
    rawDays
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  )].sort((a, b) => a - b);

  if (daysOfWeek.length === 0) {
    throw buildBadRequestError('At least one schedule day is required.');
  }

  const normalizeTime = (value, fieldLabel) => {
    if (!value) {
      throw buildBadRequestError(`${fieldLabel} is required.`);
    }

    const trimmed = String(value).trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)) {
      throw buildBadRequestError(`${fieldLabel} is invalid.`);
    }

    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  };

  const shiftStart = normalizeTime(schedule.shiftStart, 'Shift start time');
  const shiftEnd = normalizeTime(schedule.shiftEnd, 'Shift end time');

  if (shiftStart === shiftEnd) {
    throw buildBadRequestError('Shift start and end time cannot be the same.');
  }

  return {
    days_of_week: daysOfWeek,
    shift_start: shiftStart,
    shift_end: shiftEnd,
  };
}

async function getEmployeeProfileForDeployment(employeeId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      status,
      role,
      employees (
        base_salary
      )
    `)
    .eq('id', employeeId)
    .eq('role', 'employee')
    .single();

  if (error || !data) {
    const err = new Error('Employee not found');
    err.status = 404;
    throw err;
  }

  if (data.status === 'inactive') {
    throw buildBadRequestError('Inactive employees cannot be deployed.');
  }

  const employee = Array.isArray(data.employees) ? data.employees[0] : data.employees;

  return {
    ...data,
    base_salary: employee?.base_salary ?? null,
  };
}

async function getActiveSiteAssignment(siteId) {
  const { data, error } = await supabaseAdmin
    .from('client_sites')
    .select(`
      id,
      site_name,
      is_active,
      client_id
    `)
    .eq('id', siteId)
    .single();

  if (error || !data) {
    const err = new Error('Client site not found');
    err.status = 404;
    throw err;
  }

  if (!data.is_active) {
    throw buildBadRequestError('Only active client sites can receive deployments.');
  }

  return data;
}

async function getLatestContractDocumentUrl(employeeId) {
  const canonicalContract = await getCanonicalEmploymentContract(employeeId);
  if (canonicalContract?.document_url) {
    return canonicalContract.document_url;
  }

  const { data, error } = await supabaseAdmin
    .from('employee_contracts')
    .select('document_url, updated_at, start_date')
    .eq('employee_id', employeeId)
    .eq('contract_type', 'employment')
    .not('document_url', 'is', null)
    .order('start_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.document_url || null;
}

function sortEmploymentContractsByCurrentPriority(contracts = []) {
  return [...contracts].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }

    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    if (aStart !== bStart) return bStart - aStart;

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bUpdated - aUpdated;
  });
}

async function getEmploymentContracts(employeeId, { status = null } = {}) {
  let query = supabaseAdmin
    .from('employee_contracts')
    .select('id, contract_type, start_date, end_date, document_url, status, created_at, updated_at')
    .eq('employee_id', employeeId)
    .eq('contract_type', 'employment')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

async function getActiveEmploymentContracts(employeeId) {
  return getEmploymentContracts(employeeId, { status: 'active' });
}

async function getCanonicalEmploymentContract(employeeId) {
  const contracts = await getEmploymentContracts(employeeId);
  return sortEmploymentContractsByCurrentPriority(contracts)[0] || null;
}

function getEmploymentContractState(contract, today = getTodayDateString()) {
  if (!contract) {
    return {
      status: 'missing',
      isValid: false,
      needsRenewal: true,
      message: 'No employment contract is on file. Upload a signed employment contract before deployment.',
    };
  }

  if (contract.status !== 'active') {
    return {
      status: 'inactive',
      isValid: false,
      needsRenewal: true,
      message: 'Employment contract is inactive. Renew the contract before deployment.',
    };
  }

  if (contract.start_date && compareDateOnly(contract.start_date, today) > 0) {
    return {
      status: 'future',
      isValid: false,
      needsRenewal: false,
      message: 'Employment contract is not effective yet.',
    };
  }

  if (contract.end_date && compareDateOnly(contract.end_date, today) < 0) {
    return {
      status: 'expired',
      isValid: false,
      needsRenewal: true,
      message: 'Employment contract has expired. Renew the contract before deployment.',
    };
  }

  const warningDate = addDaysToDateString(today, EMPLOYMENT_CONTRACT_EXPIRY_WARNING_DAYS);
  if (contract.end_date && compareDateOnly(contract.end_date, warningDate) <= 0) {
    return {
      status: 'expiring_soon',
      isValid: true,
      needsRenewal: true,
      message: `Employment contract expires on ${contract.end_date}. Renew the contract before it ends.`,
    };
  }

  return {
    status: 'valid',
    isValid: true,
    needsRenewal: false,
    message: null,
  };
}

async function getValidActiveEmploymentContract(employeeId) {
  const activeContracts = await getActiveEmploymentContracts(employeeId);
  return activeContracts.find((contract) => getEmploymentContractState(contract).isValid) || null;
}

async function closeEmploymentContracts(contracts = [], resolveEndDate) {
  const closedContracts = [];

  for (const contract of contracts) {
    const endDate = typeof resolveEndDate === 'function'
      ? resolveEndDate(contract)
      : resolveEndDate;

    const { error } = await supabaseAdmin
      .from('employee_contracts')
      .update({
        status: 'inactive',
        end_date: endDate,
      })
      .eq('id', contract.id);

    if (error) {
      await restoreEmploymentContracts(closedContracts);
      throw error;
    }

    closedContracts.push({
      id: contract.id,
      status: contract.status,
      end_date: contract.end_date,
    });
  }

  return closedContracts;
}

async function restoreEmploymentContracts(contracts = []) {
  for (const contract of contracts) {
    await supabaseAdmin
      .from('employee_contracts')
      .update({
        status: contract.status,
        end_date: contract.end_date,
      })
      .eq('id', contract.id);
  }
}

module.exports = {
  toProperCase,
  CLEARANCE_EXPIRY_YEARS,
  normalizeDateRange,
  getTodayDateString,
  getEmploymentContractState,
  validateDateIsTodayOrLater,
  normalizeSchedule,
  getEmployeeProfileForDeployment,
  getActiveSiteAssignment,
  getLatestContractDocumentUrl,
  getEmploymentContracts,
  getActiveEmploymentContracts,
  getCanonicalEmploymentContract,
  getValidActiveEmploymentContract,
  closeEmploymentContracts,
  restoreEmploymentContracts,
};
