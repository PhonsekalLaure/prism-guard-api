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

function normalizeContractDates(startDate, endDate, fallbackStartDate = null) {
  const contractStartDate = startDate || fallbackStartDate || new Date().toISOString().split('T')[0];
  let contractEndDate = endDate || null;

  if (Number.isNaN(new Date(contractStartDate).getTime())) {
    throw buildBadRequestError('Contract start date is invalid.');
  }

  if (!contractEndDate) {
    const defaultEndDate = new Date(contractStartDate);
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 1);
    contractEndDate = defaultEndDate.toISOString().split('T')[0];
  }

  if (Number.isNaN(new Date(contractEndDate).getTime())) {
    throw buildBadRequestError('Contract end date is invalid.');
  }

  if (new Date(contractEndDate) < new Date(contractStartDate)) {
    throw buildBadRequestError('Contract end date cannot be earlier than contract start date.');
  }

  return {
    contractStartDate,
    contractEndDate,
  };
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

  if (data.status === 'terminated') {
    throw buildBadRequestError('Terminated employees cannot be deployed.');
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
      client_id,
      clients (
        company,
        rate_per_guard
      )
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
  const { data, error } = await supabaseAdmin
    .from('employee_contracts')
    .select('document_url, updated_at, start_date')
    .eq('employee_id', employeeId)
    .not('document_url', 'is', null)
    .order('updated_at', { ascending: false })
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.document_url || null;
}

module.exports = {
  toProperCase,
  CLEARANCE_EXPIRY_YEARS,
  normalizeContractDates,
  normalizeSchedule,
  getEmployeeProfileForDeployment,
  getActiveSiteAssignment,
  getLatestContractDocumentUrl,
};
