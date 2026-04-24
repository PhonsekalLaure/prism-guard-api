const { supabaseAdmin } = require('@src/supabaseClient');
const { getPaginationRange } = require('@utils/pagination');
const { applySupabaseFilters, isClientFilterActive } = require('@utils/supabaseFilters');
const {
  buildBadRequestError,
  normalizeMobileNumber,
  normalizeAddressWithCoordinates,
} = require('@utils/requestValidation');
const { rollbackProvisionedUser } = require('@utils/userProvisioning');

/**
 * Fetch a paginated list of employees with optional filters.
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @param {Object} filters - Search and status filters
 * @returns {Object} { employees: Array, totalCount: number }
 */
async function getAllEmployees(page = 1, limit = 6, filters = null) {
  const { from, to } = getPaginationRange(page, limit);
  const useInner = isClientFilterActive(filters);

  // Use !inner if we are filtering by client to only return matching rows
  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      status,
      avatar_url,
      employees${useInner ? '!inner' : ''} (
        employee_id_number,
        position,
        hire_date,
        deployments!deployments_employee_id_fkey${useInner ? '!inner' : ''} (
          status,
          client_sites!inner (
            site_name,
            client_id,
            clients (
              company
            )
          )
        )
      )
    `, { count: 'exact' })
    .eq('role', 'employee');

  // Apply shared filters
  query = applySupabaseFilters(query, filters);

  const { data: profiles, error, count } = await query.range(from, to);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const profileData = profiles || [];
  const formatted = profileData.map(p => {
    const emp = Array.isArray(p.employees) ? p.employees[0] : (p.employees || {});
    
    let deployments = [];
    if (Array.isArray(emp.deployments)) {
      deployments = emp.deployments;
    } else if (emp.deployments) {
      deployments = [emp.deployments];
    }

    const activeDeployment = deployments.find(d => d.status === 'active');
    const companyName = activeDeployment?.client_sites?.clients?.company || 'Floating';
    
    let tenure = 'N/A';
    if (emp.hire_date) {
      const diff = new Date() - new Date(emp.hire_date);
      const years = diff / (1000 * 60 * 60 * 24 * 365.25);
      if (years >= 1) {
        tenure = `${years.toFixed(1)} years tenure`;
      } else {
        const months = diff / (1000 * 60 * 60 * 24 * 30);
        tenure = `${Math.floor(months)} months tenure`;
      }
    }

    return {
      id: p.id,
      employee_id_number: emp.employee_id_number || 'N/A',
      name: `${p.first_name} ${p.last_name}`,
      initials: `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`,
      avatar_url: p.avatar_url || null,
      status: p.status, // e.g. 'active', 'inactive'
      position: emp.position || 'N/A',
      client: companyName,
      tenure: tenure
    };
  });

  return {
    employees: formatted,
    totalCount: count || 0
  };
}

/**
 * Fetch detailed information for a specific employee.
 * @param {string} id - The UUID of the employee matching their profile ID
 * @returns {Object} Detailed employee data
 */
async function getEmployeeDetails(id) {
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
      avatar_url,
      employees (
        id,
        employee_id_number,
        position,
        hire_date,
        base_salary,
        pay_frequency,
        tin_number,
        sss_number,
        philhealth_number,
        pagibig_number,
        date_of_birth,
        gender,
        civil_status,
        citizenship,
        height_cm,
        educational_level,
        employment_type,
        residential_address,
        latitude,
        longitude,
        emergency_contact_name,
        emergency_contact_number,
        deployments!deployments_employee_id_fkey (
          id,
          status,
          start_date,
          end_date,
          client_sites (
            site_name,
            clients (
              company
            )
          )
        ),
        clearances (
          id,
          clearance_type,
          document_url,
          issue_date,
          expiry_date,
          status
        ),
        payroll_records (
          id,
          period_start,
          period_end,
          basic_pay,
          overtime_pay,
          statutory_deductions,
          net_pay,
          status,
          payment_date
        )
      )
    `)
    .eq('id', id)
    .eq('role', 'employee')
    .single();

  if (error || !profile) {
    const err = new Error('Employee not found');
    err.status = 404;
    throw err;
  }

  const emp = Array.isArray(profile.employees) ? profile.employees[0] : (profile.employees || {});

  // Compute age
  let age = null;
  if (emp.date_of_birth) {
    const d1 = new Date();
    const d2 = new Date(emp.date_of_birth);
    age = new Date(d1 - d2).getFullYear() - 1970;
  }

  // Prepare arrays
  const deployments = Array.isArray(emp.deployments) ? emp.deployments : (emp.deployments ? [emp.deployments] : []);
  const clearances = Array.isArray(emp.clearances) ? emp.clearances : (emp.clearances ? [emp.clearances] : []);
  const payroll = Array.isArray(emp.payroll_records) ? emp.payroll_records : (emp.payroll_records ? [emp.payroll_records] : []);

  // Sort payroll by period end descending
  payroll.sort((a, b) => new Date(b.period_end) - new Date(a.period_end));

  const activeDeployment = deployments.find(d => d.status === 'active');
  const companyName = activeDeployment?.client_sites?.clients?.company || 'Floating';
  const siteName = activeDeployment?.client_sites?.site_name || 'None';

  return {
    id: profile.id, // UUID
    employee_id_number: emp.employee_id_number || 'N/A',
    name: `${profile.first_name} ${profile.last_name}`,
    full_name: `${profile.first_name} ${profile.middle_name ? profile.middle_name + ' ' : ''}${profile.last_name}`,
    initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`,
    status: profile.status,
    contact_email: profile.contact_email,
    phone_number: profile.phone_number,
    avatar_url: profile.avatar_url,
    
    // Personal
    date_of_birth: emp.date_of_birth,
    age: age,
    gender: emp.gender,
    civil_status: emp.civil_status,
    citizenship: emp.citizenship,
    height_cm: emp.height_cm,
    educational_level: emp.educational_level,
    residential_address: emp.residential_address,
    latitude: emp.latitude,
    longitude: emp.longitude,
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_number: emp.emergency_contact_number,

    // Employment
    position: emp.position,
    hire_date: emp.hire_date,
    base_salary: emp.base_salary,
    pay_frequency: emp.pay_frequency,
    employment_type: emp.employment_type,
    current_company: companyName,
    current_site: siteName,

    // IDs
    tin_number: emp.tin_number,
    sss_number: emp.sss_number,
    philhealth_number: emp.philhealth_number,
    pagibig_number: emp.pagibig_number,

    // Relations
    clearances: clearances,
    payroll_records: payroll,
    deployments: deployments
  };
}

/**
 * Fetch statistics for the Employees Dashboard
 * @returns {Object} Stats: total, active, on_leave, absent_today, active_on_duty
 */
async function getEmployeeStats() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Get counts from profiles table
  const { data: statusCounts, error: statusError } = await supabaseAdmin
    .from('profiles')
    .select('status')
    .eq('role', 'employee');

  if (statusError) throw statusError;

  const stats = {
    total: statusCounts.length,
    active: statusCounts.filter(p => p.status === 'active').length,
    on_leave: statusCounts.filter(p => p.status === 'on-leave').length,
    suspended: statusCounts.filter(p => p.status === 'suspended').length,
  };

  // 2. Get today's attendance stats
  const { data: attendanceToday, error: attendanceError } = await supabaseAdmin
    .from('attendance_logs')
    .select('employee_id, status')
    .eq('log_date', today);

  if (attendanceError) throw attendanceError;

  const clockInCount = new Set(attendanceToday.map(a => a.employee_id)).size;
  
  return {
    totalEmployees: stats.total,
    onLeave: stats.on_leave,
    absentToday: stats.total - stats.active - stats.on_leave, // Simplification: anyone not active or on-leave
    activeOnDuty: clockInCount, // Actual clock-ins today
  };
}

/**
 * Helper to convert strings to Proper Case (Capitalized First Letter of Each Word)
 */
function toProperCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

/**
 * Creates a new employee user, profile, employee details, and clearance records.
 */
async function createEmployee(data, clearancesData, avatarUrl = null) {
  // Normalize strings
  const firstName = toProperCase(data.firstName);
  const middleName = data.middleName ? toProperCase(data.middleName) : null;
  const lastName = toProperCase(data.lastName);
  const suffix = data.suffix ? data.suffix.trim() : null; // Suffix stay as-is (e.g. Jr.)
  const employmentType = (data.employmentType || 'regular').toLowerCase();
  const payFrequency = 'semi_monthly';
  const mobile = normalizeMobileNumber(data.mobile, { required: true, fieldLabel: 'Mobile number' });
  const emergencyContactNumber = normalizeMobileNumber(data.emergencyContact, {
    required: true,
    fieldLabel: 'Emergency contact number',
  });
  const normalizedAddress = normalizeAddressWithCoordinates(
    data.address,
    data.latitude,
    data.longitude,
    {
      addressLabel: 'Residential address',
      requireAddress: true,
      requireCoordinates: true,
    }
  );

  const allowedEmploymentTypes = new Set(['regular', 'reliever']);
  if (!allowedEmploymentTypes.has(employmentType)) {
    throw buildBadRequestError('Invalid employment type.');
  }

  if (data.hireDate && data.dob) {
    const hireDate = new Date(data.hireDate);
    const birthDate = new Date(data.dob);
    if (hireDate < birthDate) {
      throw buildBadRequestError('Hire date cannot be earlier than date of birth.');
    }
  }

  // 1. Invite auth user
  let userId = null;

  try {
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
        avatar_url: avatarUrl,
        role: 'employee',
        status: 'active'
      }]);

    if (profileError) throw profileError;

    // 3. Insert into employees
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .insert([{
        id: userId,
        employee_id_number: data.employeeId,
        position: data.position,
        hire_date: data.hireDate,
        base_salary: data.basicRate ? parseFloat(data.basicRate) : null,
        pay_frequency: payFrequency,
        tin_number: data.tinNumber || null,
        sss_number: data.sssNumber || null,
        philhealth_number: data.philhealthNumber || null,
        pagibig_number: data.pagibigNumber || null,
        date_of_birth: data.dob,
        gender: data.gender,
        civil_status: data.civilStatus,
        height_cm: data.height ? parseFloat(data.height) : null,
        educational_level: data.educationalLevel,
        residential_address: normalizedAddress.address,
        emergency_contact_name: toProperCase(data.emergencyName),
        emergency_contact_number: emergencyContactNumber,
        employment_type: employmentType,
        latitude: normalizedAddress.latitude,
        longitude: normalizedAddress.longitude
      }]);

    if (empError) throw empError;

    // 4. Insert clearances if they exist
    if (clearancesData && clearancesData.length > 0) {
      const clearancesToInsert = clearancesData.map(c => ({
        employee_id: userId,
        clearance_type: c.type,
        document_url: c.url,
        issue_date: new Date().toISOString().split('T')[0], // Simplified assuming today's date
        status: 'valid'
      }));

      const { error: clearError } = await supabaseAdmin
        .from('clearances')
        .insert(clearancesToInsert);

      if (clearError) console.error("Failed to insert clearances:", clearError);
      // Soft fail if clearances don't insert, we still have the employee
    }

    return { userId };
  } catch (err) {
    if (userId) {
      await rollbackProvisionedUser(supabaseAdmin, userId, 'createEmployee');
    }
    throw err;
  }
}

/**
 * Determines the next available sequential Employee ID (PG-XXXXX).
 */
async function getNextEmployeeId() {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('employee_id_number')
    .like('employee_id_number', 'PG-%')
    .order('employee_id_number', { ascending: false })
    .limit(1);

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  if (!data || data.length === 0) {
    return 'PG-00001';
  }

  const lastIdStr = data[0].employee_id_number; // e.g., 'PG-00010'
  const match = lastIdStr.match(/PG-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PG-${String(nextNum).padStart(5, '0')}`;
  }

  return 'PG-00001'; // Fallback
}

/**
 * Updates an existing employee's personal, contact, employment fields,
 * and optionally upserts clearance document URLs.
 *
 * @param {string} id            - The profile UUID of the employee
 * @param {Object} data          - Flat object of field updates
 * @param {Array}  clearances    - Array of { type, url } for updated documents
 */
async function updateEmployee(id, data, clearances = []) {
  // ── 1. Update profiles table ──────────────────────────────────────────────
  const profilePatch = {};
  if (data.phone_number !== undefined) {
    profilePatch.phone_number = normalizeMobileNumber(data.phone_number, {
      required: true,
      fieldLabel: 'Phone number',
    });
  }
  if (data.contact_email !== undefined) profilePatch.contact_email = data.contact_email || null;

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profilePatch)
      .eq('id', id);
    if (profileError) throw profileError;
  }

  // ── 2. Update employees table ─────────────────────────────────────────────
  const empPatch = {};
  if (data.date_of_birth           !== undefined) empPatch.date_of_birth           = data.date_of_birth           || null;
  if (data.gender                  !== undefined) empPatch.gender                  = data.gender                  || null;
  if (data.civil_status            !== undefined) empPatch.civil_status            = data.civil_status            || null;
  if (data.height_cm               !== undefined) empPatch.height_cm               = data.height_cm ? parseFloat(data.height_cm) : null;
  if (data.educational_level       !== undefined) empPatch.educational_level       = data.educational_level       || null;
  if (data.residential_address !== undefined || data.latitude !== undefined || data.longitude !== undefined) {
    const normalizedAddress = normalizeAddressWithCoordinates(
      data.residential_address,
      data.latitude,
      data.longitude,
      {
        addressLabel: 'Residential address',
        requireAddress: false,
        requireCoordinates: false,
      }
    );
    empPatch.residential_address = normalizedAddress.address;
    empPatch.latitude = normalizedAddress.latitude;
    empPatch.longitude = normalizedAddress.longitude;
  }
  if (data.emergency_contact_name  !== undefined) {
    const name = (data.emergency_contact_name || '').trim();
    empPatch.emergency_contact_name = name
      ? name.replace(/\b\w/g, c => c.toUpperCase())
      : null;
  }
  if (data.emergency_contact_number !== undefined) {
    empPatch.emergency_contact_number = normalizeMobileNumber(data.emergency_contact_number, {
      required: false,
      fieldLabel: 'Emergency contact number',
    });
  }
  if (data.position        !== undefined) empPatch.position        = data.position        || null;
  if (data.employment_type !== undefined) empPatch.employment_type = (data.employment_type || '').toLowerCase() || null;
  if (Object.keys(empPatch).length > 0) {
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .update(empPatch)
      .eq('id', id);
    if (empError) throw empError;
  }

  // ── 3. Upsert clearances ──────────────────────────────────────────────────
  if (clearances.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const upsertRows = clearances.map(c => ({
      employee_id:    id,
      clearance_type: c.type,
      document_url:   c.url,
      issue_date:     today,
      status:         'valid'
    }));

    const { error: clearError } = await supabaseAdmin
      .from('clearances')
      .upsert(upsertRows, { onConflict: 'employee_id,clearance_type' });

    if (clearError) throw clearError;
  }

  return { success: true };
}

module.exports = {
  getAllEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  createEmployee,
  updateEmployee,
  getNextEmployeeId
};
