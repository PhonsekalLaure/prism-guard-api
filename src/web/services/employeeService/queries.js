const {
  supabaseAdmin,
  getPaginationRange,
  applySupabaseFilters,
} = require('./shared');

async function getAllEmployees(page = 1, limit = 6, filters = null) {
  const clientFilter = filters?.client || 'all';
  const shouldPostFilterByActiveDeployment = clientFilter && clientFilter !== 'all';
  const { from, to } = getPaginationRange(page, limit);
  const dbFilters = shouldPostFilterByActiveDeployment
    ? { ...filters, client: 'all' }
    : filters;

  let query = supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      status,
      avatar_url,
      employees (
        employee_id_number,
        position,
        hire_date,
        deployments!deployments_employee_id_fkey (
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

  query = applySupabaseFilters(query, dbFilters);

  if (!shouldPostFilterByActiveDeployment) {
    query = query.range(from, to);
  }

  const { data: profiles, error, count } = await query;

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const profileData = profiles || [];
  const formatted = profileData.map((p) => {
    const emp = Array.isArray(p.employees) ? p.employees[0] : (p.employees || {});

    let deployments = [];
    if (Array.isArray(emp.deployments)) {
      deployments = emp.deployments;
    } else if (emp.deployments) {
      deployments = [emp.deployments];
    }

    const activeDeployment = deployments.find((d) => d.status === 'active');
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
      status: p.status,
      position: emp.position || 'N/A',
      active_client_id: activeDeployment?.client_sites?.client_id || null,
      client: companyName,
      tenure,
    };
  });

  const filteredByActiveDeployment = shouldPostFilterByActiveDeployment
    ? formatted.filter((employee) => (
      clientFilter === 'unassigned'
        ? employee.active_client_id == null
        : employee.active_client_id === clientFilter
    ))
    : formatted;

  const paginatedEmployees = shouldPostFilterByActiveDeployment
    ? filteredByActiveDeployment.slice(from, to + 1)
    : formatted;

  return {
    employees: paginatedEmployees,
    totalCount: shouldPostFilterByActiveDeployment
      ? filteredByActiveDeployment.length
      : (count || 0),
  };
}

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
        provincial_address,
        place_of_birth,
        blood_type,
        badge_number,
        license_number,
        license_expiry_date,
        latitude,
        longitude,
        emergency_contact_name,
        emergency_contact_number,
        emergency_contact_relationship,
        deployments!deployments_employee_id_fkey (
          id,
          status,
          start_date,
          end_date,
          deployment_order_url,
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

  let age = null;
  if (emp.date_of_birth) {
    const dob = new Date(emp.date_of_birth);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
      age--;
    }
  }

  const deployments = Array.isArray(emp.deployments) ? emp.deployments : (emp.deployments ? [emp.deployments] : []);
  const clearances = Array.isArray(emp.clearances) ? emp.clearances : (emp.clearances ? [emp.clearances] : []);
  const payroll = Array.isArray(emp.payroll_records) ? emp.payroll_records : (emp.payroll_records ? [emp.payroll_records] : []);

  const { data: latestContract, error: contractError } = await supabaseAdmin
    .from('employee_contracts')
    .select('document_url, start_date, end_date, updated_at')
    .eq('employee_id', id)
    .order('updated_at', { ascending: false })
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractError) {
    const err = new Error(contractError.message);
    err.status = 500;
    throw err;
  }

  payroll.sort((a, b) => new Date(b.period_end) - new Date(a.period_end));

  const activeDeployment = deployments.find((d) => d.status === 'active');
  const latestDeployment = activeDeployment || [...deployments].sort((a, b) => {
    const aDate = a?.start_date ? new Date(a.start_date).getTime() : 0;
    const bDate = b?.start_date ? new Date(b.start_date).getTime() : 0;
    return bDate - aDate;
  })[0];
  const companyName = activeDeployment?.client_sites?.clients?.company || 'Floating';
  const siteName = activeDeployment?.client_sites?.site_name || 'None';

  return {
    id: profile.id,
    employee_id_number: emp.employee_id_number || 'N/A',
    name: `${profile.first_name} ${profile.last_name}`,
    full_name: `${profile.first_name} ${profile.middle_name ? `${profile.middle_name} ` : ''}${profile.last_name}`,
    initials: `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`,
    status: profile.status,
    contact_email: profile.contact_email,
    phone_number: profile.phone_number,
    avatar_url: profile.avatar_url,
    date_of_birth: emp.date_of_birth,
    age,
    gender: emp.gender,
    civil_status: emp.civil_status,
    citizenship: emp.citizenship,
    height_cm: emp.height_cm,
    educational_level: emp.educational_level,
    residential_address: emp.residential_address,
    provincial_address: emp.provincial_address,
    place_of_birth: emp.place_of_birth,
    blood_type: emp.blood_type,
    badge_number: emp.badge_number,
    license_number: emp.license_number,
    license_expiry_date: emp.license_expiry_date,
    latitude: emp.latitude,
    longitude: emp.longitude,
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_number: emp.emergency_contact_number,
    emergency_contact_relationship: emp.emergency_contact_relationship,
    position: emp.position,
    hire_date: emp.hire_date,
    base_salary: emp.base_salary,
    pay_frequency: emp.pay_frequency,
    employment_type: emp.employment_type,
    current_company: companyName,
    current_site: siteName,
    tin_number: emp.tin_number,
    sss_number: emp.sss_number,
    philhealth_number: emp.philhealth_number,
    pagibig_number: emp.pagibig_number,
    clearances,
    payroll_records: payroll,
    deployments,
    deployment_order_url: latestDeployment?.deployment_order_url || null,
    document_url: latestContract?.document_url || null,
  };
}

async function getEmployeeStats() {
  const today = new Date().toISOString().split('T')[0];

  const { data: statusCounts, error: statusError } = await supabaseAdmin
    .from('profiles')
    .select('status')
    .eq('role', 'employee');

  if (statusError) throw statusError;

  const stats = {
    total: statusCounts.length,
    active: statusCounts.filter((p) => p.status === 'active').length,
    inactive: statusCounts.filter((p) => p.status === 'inactive').length,
    terminated: statusCounts.filter((p) => p.status === 'terminated').length,
  };

  const { data: attendanceToday, error: attendanceError } = await supabaseAdmin
    .from('attendance_logs')
    .select('employee_id, status')
    .eq('log_date', today);

  if (attendanceError) throw attendanceError;

  const clockInCount = new Set(attendanceToday.map((a) => a.employee_id)).size;

  return {
    totalEmployees: stats.total,
    inactive: stats.inactive,
    terminated: stats.terminated,
    absentToday: stats.active - clockInCount,
    activeOnDuty: clockInCount,
  };
}

async function getDeployableEmployees() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      status,
      employees!inner (
        employee_id_number,
        position,
        deployments!deployments_employee_id_fkey (
          status
        )
      )
    `)
    .eq('role', 'employee')
    .eq('status', 'active');

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }

  const profiles = data || [];

  return profiles
    .filter((profile) => {
      const employee = Array.isArray(profile.employees) ? profile.employees[0] : profile.employees;
      const deployments = Array.isArray(employee?.deployments)
        ? employee.deployments
        : (employee?.deployments ? [employee.deployments] : []);

      return !deployments.some((deployment) => deployment.status === 'active');
    })
    .map((profile) => {
      const employee = Array.isArray(profile.employees) ? profile.employees[0] : profile.employees;

      return {
        id: profile.id,
        employee_id_number: employee?.employee_id_number || 'N/A',
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        position: employee?.position || 'N/A',
        status: profile.status,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

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

  const lastIdStr = data[0].employee_id_number;
  const match = lastIdStr.match(/PG-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `PG-${String(nextNum).padStart(5, '0')}`;
  }

  return 'PG-00001';
}

module.exports = {
  getAllEmployees,
  getEmployeeDetails,
  getEmployeeStats,
  getDeployableEmployees,
  getNextEmployeeId,
};
