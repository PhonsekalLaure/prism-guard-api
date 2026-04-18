const { supabaseAdmin } = require('../../supabaseClient');
const { getPaginationRange } = require('../utils/pagination');
const { applySupabaseFilters, isClientFilterActive } = require('../utils/supabaseFilters');

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
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_number: emp.emergency_contact_number,

    // Employment
    position: emp.position,
    hire_date: emp.hire_date,
    base_salary: emp.base_salary,
    pay_frequency: emp.pay_frequency,
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

module.exports = {
  getAllEmployees,
  getEmployeeDetails,
  getEmployeeStats
};
