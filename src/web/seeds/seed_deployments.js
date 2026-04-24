/**
 * Seed script for deployment-driven HRIS data.
 *
 * Creates:
 *   - client sites for every seeded client
 *   - active employee deployments and schedules
 *   - today's attendance logs for a subset of deployed guards
 *   - recent payroll history for all employees
 *   - client billing records
 *   - client service tickets
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 *
 * Usage:
 *   node src/web/seeds/seed_deployments.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const siteBlueprints = {
  'Golden Pacific Realty': [
    {
      site_name: 'Pacific Tower Main Lobby',
      site_address: '25F Pacific Tower, Makati Ave, Makati City',
      latitude: 14.5567,
      longitude: 121.0235,
      geofence_radius_meters: 80,
      is_active: false,
    },
    {
      site_name: 'Pacific Tower Parking Annex',
      site_address: '27 Makati Ave, Makati City',
      latitude: 14.5575,
      longitude: 121.0247,
      geofence_radius_meters: 90,
      is_active: false,
    },
  ],
  'Metro Edge Logistics': [
    {
      site_name: 'Warehouse A',
      site_address: '88 Warehouse Rd, Pasig City',
      latitude: 14.5814,
      longitude: 121.0672,
      geofence_radius_meters: 120,
      is_active: false,
    },
    {
      site_name: 'Crossdock Yard',
      site_address: '90 Logistics Loop, Pasig City',
      latitude: 14.5829,
      longitude: 121.0694,
      geofence_radius_meters: 140,
      is_active: false,
    },
  ],
  'Sunrise Mall Corp': [
    {
      site_name: 'Mall Perimeter',
      site_address: 'Sunrise Mall, Commonwealth Ave, Quezon City',
      latitude: 14.6508,
      longitude: 121.0315,
      geofence_radius_meters: 150,
      is_active: true,
    },
    {
      site_name: 'North Entrance',
      site_address: 'Sunrise Mall North Wing, Quezon City',
      latitude: 14.6517,
      longitude: 121.0328,
      geofence_radius_meters: 110,
      is_active: true,
    },
  ],
  'Vista Homes Development': [
    {
      site_name: 'Lakeside Main Gate',
      site_address: '12 Lakeside Dr, Taguig City',
      latitude: 14.5179,
      longitude: 121.0555,
      geofence_radius_meters: 100,
      is_active: true,
    },
    {
      site_name: 'Clubhouse and Amenities',
      site_address: '14 Lakeside Dr, Taguig City',
      latitude: 14.5186,
      longitude: 121.0566,
      geofence_radius_meters: 75,
      is_active: true,
    },
  ],
  'PrimeTech Solutions': [
    {
      site_name: 'Innovation Hub Lobby',
      site_address: '9F Innovation Hub, BGC, Taguig City',
      latitude: 14.5512,
      longitude: 121.0489,
      geofence_radius_meters: 60,
      is_active: true,
    },
    {
      site_name: 'Data Center Receiving Bay',
      site_address: '8F Innovation Hub Annex, BGC, Taguig City',
      latitude: 14.5502,
      longitude: 121.0497,
      geofence_radius_meters: 85,
      is_active: true,
    },
  ],
};

const deploymentPlan = [
  {
    employee_email: 'marco.santos@prismguard.com',
    company: 'Sunrise Mall Corp',
    site_name: 'Mall Perimeter',
    start_date: '2026-01-06',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5, 6],
    shift_start: '22:00:00',
    shift_end: '06:00:00',
    attendance_status: 'on_time',
  },
  {
    employee_email: 'jose.delacruz@prismguard.com',
    company: 'Vista Homes Development',
    site_name: 'Lakeside Main Gate',
    start_date: '2025-12-02',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5, 6],
    shift_start: '06:00:00',
    shift_end: '14:00:00',
    attendance_status: 'late',
  },
  {
    employee_email: 'daniel.garcia@prismguard.com',
    company: 'PrimeTech Solutions',
    site_name: 'Innovation Hub Lobby',
    start_date: '2025-11-10',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5],
    shift_start: '14:00:00',
    shift_end: '22:00:00',
    attendance_status: 'on_time',
  },
  {
    employee_email: 'miguel.ramos@prismguard.com',
    company: 'Sunrise Mall Corp',
    site_name: 'North Entrance',
    start_date: '2026-02-17',
    deployment_type: 'reliever',
    status: 'active',
    days_of_week: [5, 6, 0],
    shift_start: '18:00:00',
    shift_end: '02:00:00',
    covering_for_email: 'marco.santos@prismguard.com',
    attendance_status: 'on_time',
  },
  {
    employee_email: 'adrian.fernandez@prismguard.com',
    company: 'PrimeTech Solutions',
    site_name: 'Data Center Receiving Bay',
    start_date: '2025-10-20',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5],
    shift_start: '08:00:00',
    shift_end: '17:00:00',
    attendance_status: 'on_time',
  },
  {
    employee_email: 'paolo.lim@prismguard.com',
    company: 'Vista Homes Development',
    site_name: 'Clubhouse and Amenities',
    start_date: '2026-03-03',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5, 6],
    shift_start: '14:00:00',
    shift_end: '22:00:00',
    attendance_status: 'late',
  },
  {
    employee_email: 'carlos.aquino@prismguard.com',
    company: 'Sunrise Mall Corp',
    site_name: 'North Entrance',
    start_date: '2025-09-15',
    deployment_type: 'regular',
    status: 'active',
    days_of_week: [1, 2, 3, 4, 5],
    shift_start: '08:00:00',
    shift_end: '17:00:00',
  },
];

const billingBlueprints = {
  'Golden Pacific Realty': [
    {
      period_start: '2025-12-01',
      period_end: '2025-12-31',
      total_amount: 49000,
      amount_paid: 49000,
      balance_due: 0,
      due_date: '2026-01-10',
      status: 'paid',
      payment_date: '2026-01-08',
      payment_reference: 'GPR-2026-0108',
    },
    {
      period_start: '2026-01-01',
      period_end: '2026-01-14',
      total_amount: 22867,
      amount_paid: 22867,
      balance_due: 0,
      due_date: '2026-01-24',
      status: 'paid',
      payment_date: '2026-01-21',
      payment_reference: 'GPR-2026-0121',
    },
  ],
  'Metro Edge Logistics': [
    {
      period_start: '2026-01-16',
      period_end: '2026-01-31',
      total_amount: 45600,
      amount_paid: 45600,
      balance_due: 0,
      due_date: '2026-02-10',
      status: 'paid',
      payment_date: '2026-02-08',
      payment_reference: 'MEL-2026-0208',
    },
    {
      period_start: '2026-02-01',
      period_end: '2026-02-28',
      total_amount: 79800,
      amount_paid: 79800,
      balance_due: 0,
      due_date: '2026-03-10',
      status: 'paid',
      payment_date: '2026-03-06',
      payment_reference: 'MEL-2026-0306',
    },
  ],
  'Sunrise Mall Corp': [
    {
      period_start: '2026-03-16',
      period_end: '2026-03-31',
      total_amount: 157500,
      amount_paid: 157500,
      balance_due: 0,
      due_date: '2026-04-10',
      status: 'paid',
      payment_date: '2026-04-08',
      payment_reference: 'SMC-2026-0408',
    },
    {
      period_start: '2026-04-01',
      period_end: '2026-04-15',
      total_amount: 157500,
      amount_paid: 105000,
      balance_due: 52500,
      due_date: '2026-04-25',
      status: 'partial',
      payment_date: '2026-04-19',
      payment_reference: 'SMC-2026-0419',
    },
  ],
  'Vista Homes Development': [
    {
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      total_amount: 95200,
      amount_paid: 95200,
      balance_due: 0,
      due_date: '2026-04-10',
      status: 'paid',
      payment_date: '2026-04-05',
      payment_reference: 'VHD-2026-0405',
    },
    {
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      total_amount: 95200,
      amount_paid: 0,
      balance_due: 95200,
      due_date: '2026-05-10',
      status: 'unpaid',
      payment_date: null,
      payment_reference: null,
    },
  ],
  'PrimeTech Solutions': [
    {
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      total_amount: 110000,
      amount_paid: 110000,
      balance_due: 0,
      due_date: '2026-04-10',
      status: 'paid',
      payment_date: '2026-04-04',
      payment_reference: 'PTS-2026-0404',
    },
    {
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      total_amount: 110000,
      amount_paid: 55000,
      balance_due: 55000,
      due_date: '2026-05-10',
      status: 'partial',
      payment_date: '2026-04-20',
      payment_reference: 'PTS-2026-0420',
    },
  ],
};

const ticketBlueprints = {
  'Golden Pacific Realty': [
    {
      ticket_type: 'contract_closeout',
      subject: 'Request for final post coverage report',
      description: 'Client requested a consolidated report for the final two weeks of tower coverage before contract turnover.',
      priority: 'normal',
      status: 'resolved',
      created_at: '2026-01-10T09:15:00Z',
      resolved_at: '2026-01-12T14:30:00Z',
      resolution_notes: 'Submitted final deployment summary and incident-free turnover report.',
    },
  ],
  'Metro Edge Logistics': [
    {
      ticket_type: 'billing',
      subject: 'Clarification on final February invoice',
      description: 'Finance team requested a breakdown of man-hours billed during the last contract month.',
      priority: 'normal',
      status: 'resolved',
      created_at: '2026-02-25T07:45:00Z',
      resolved_at: '2026-02-27T11:00:00Z',
      resolution_notes: 'Shared attendance-backed billing summary and signed acknowledgment.',
    },
  ],
  'Sunrise Mall Corp': [
    {
      ticket_type: 'operations',
      subject: 'Add roving guard during weekend sale',
      description: 'Mall admin asked for an extra reliever to support heavier weekend foot traffic near the north entrance.',
      priority: 'high',
      status: 'in_progress',
      created_at: '2026-04-16T03:30:00Z',
      resolved_at: null,
      resolution_notes: null,
      assigned_to_email: 'miguel.ramos@prismguard.com',
      site_name: 'North Entrance',
    },
    {
      ticket_type: 'incident_followup',
      subject: 'Review CCTV escort coverage near loading bay',
      description: 'Operations requested a joint review of escort timing after a tenant reported delayed response during late-night unloading.',
      priority: 'urgent',
      status: 'open',
      created_at: '2026-04-20T10:00:00Z',
      resolved_at: null,
      resolution_notes: null,
      assigned_to_email: 'carlos.aquino@prismguard.com',
      site_name: 'Mall Perimeter',
    },
  ],
  'Vista Homes Development': [
    {
      ticket_type: 'client_request',
      subject: 'Weekend clubhouse access log endorsement',
      description: 'Property management requested a cleaner handoff of guest and contractor access logs every Monday morning.',
      priority: 'normal',
      status: 'open',
      created_at: '2026-04-12T08:20:00Z',
      resolved_at: null,
      resolution_notes: null,
      assigned_to_email: 'paolo.lim@prismguard.com',
      site_name: 'Clubhouse and Amenities',
    },
  ],
  'PrimeTech Solutions': [
    {
      ticket_type: 'operations',
      subject: 'Badge validation at receiving bay',
      description: 'Client asked for stricter badge validation during off-hours deliveries to the data center receiving bay.',
      priority: 'high',
      status: 'in_progress',
      created_at: '2026-04-09T05:00:00Z',
      resolved_at: null,
      resolution_notes: null,
      assigned_to_email: 'adrian.fernandez@prismguard.com',
      site_name: 'Data Center Receiving Bay',
    },
  ],
};

function byKey(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key]] = row;
    return acc;
  }, {});
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function insertClientSites(clientsByCompany) {
  console.log('\nCreating client sites...');

  const createdSites = [];

  for (const [company, blueprints] of Object.entries(siteBlueprints)) {
    const client = clientsByCompany[company];

    if (!client) {
      throw new Error(`Client not found for site creation: ${company}`);
    }

    for (const site of blueprints) {
      const { data, error } = await supabase
        .from('client_sites')
        .insert({
          client_id: client.id,
          site_name: site.site_name,
          site_address: site.site_address,
          latitude: site.latitude,
          longitude: site.longitude,
          geofence_radius_meters: site.geofence_radius_meters,
          is_active: site.is_active,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Site creation failed for ${company} / ${site.site_name}: ${error.message}`);
      }

      createdSites.push(data);
      console.log(`  OK site: ${company} - ${site.site_name}`);
    }
  }

  return createdSites;
}

async function insertDeploymentsAndAttendance(employeesByEmail, sitesByKey) {
  console.log('\nCreating deployments, schedules, and attendance...');

  const createdDeployments = [];

  for (const plan of deploymentPlan) {
    const employee = employeesByEmail[plan.employee_email];

    if (!employee) {
      throw new Error(`Employee not found for deployment: ${plan.employee_email}`);
    }

    const site = sitesByKey[`${plan.company}::${plan.site_name}`];
    if (!site) {
      throw new Error(`Site not found for deployment: ${plan.company} / ${plan.site_name}`);
    }

    let coveringForEmployeeId = null;
    if (plan.covering_for_email) {
      const coveringEmployee = employeesByEmail[plan.covering_for_email];
      if (!coveringEmployee) {
        throw new Error(`Covering employee not found: ${plan.covering_for_email}`);
      }
      coveringForEmployeeId = coveringEmployee.employee_id;
    }

    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .insert({
        employee_id: employee.employee_id,
        site_id: site.id,
        start_date: plan.start_date,
        end_date: null,
        status: plan.status,
        deployment_type: plan.deployment_type,
        covering_for_employee_id: coveringForEmployeeId,
      })
      .select()
      .single();

    if (deploymentError) {
      throw new Error(`Deployment failed for ${employee.name}: ${deploymentError.message}`);
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .insert({
        deployment_id: deployment.id,
        days_of_week: plan.days_of_week,
        shift_start: plan.shift_start,
        shift_end: plan.shift_end,
        is_active: true,
      })
      .select()
      .single();

    if (scheduleError) {
      throw new Error(`Schedule failed for ${employee.name}: ${scheduleError.message}`);
    }

    if (plan.attendance_status) {
      const now = new Date();
      const { error: attendanceError } = await supabase.from('attendance_logs').insert({
        employee_id: employee.employee_id,
        site_id: site.id,
        schedule_id: schedule.id,
        log_date: formatDate(now),
        clock_in: now.toISOString(),
        status: plan.attendance_status,
      });

      if (attendanceError) {
        throw new Error(`Attendance failed for ${employee.name}: ${attendanceError.message}`);
      }
    }

    createdDeployments.push({ ...deployment, employee, site, schedule });
    console.log(`  OK deployment: ${employee.name} -> ${plan.company} / ${plan.site_name}`);
  }

  return createdDeployments;
}

async function insertPayroll(employeesByEmail) {
  console.log('\nGenerating payroll history...');

  const payrollPeriods = [
    {
      period_start: '2026-03-16',
      period_end: '2026-03-31',
      payment_date: '2026-04-05',
      status: 'paid',
    },
    {
      period_start: '2026-04-01',
      period_end: '2026-04-15',
      payment_date: '2026-04-20',
      status: 'paid',
    },
  ];

  const deployedEmails = new Set(deploymentPlan.map((plan) => plan.employee_email));

  for (const employee of Object.values(employeesByEmail)) {
    const isDeployed = deployedEmails.has(employee.contact_email);
    const baseSemiMonthly = Number(employee.base_salary || 18000) / 2;

    for (const [index, period] of payrollPeriods.entries()) {
      const overtimePay = isDeployed ? (index === 0 ? 850 : 1250) : 0;
      const holidayPay = isDeployed && employee.position === 'Shift Supervisor' ? 400 : 0;
      const statutoryDeductions = isDeployed ? 1325 : 950;
      const absencesDeduction = isDeployed ? 0 : 250;
      const basicPay = isDeployed ? baseSemiMonthly : Math.max(baseSemiMonthly - 1200, 0);
      const netPay = basicPay + overtimePay + holidayPay - statutoryDeductions - absencesDeduction;

      const { error } = await supabase.from('payroll_records').insert({
        employee_id: employee.employee_id,
        period_start: period.period_start,
        period_end: period.period_end,
        basic_pay: basicPay,
        overtime_pay: overtimePay,
        holiday_pay: holidayPay,
        statutory_deductions: statutoryDeductions,
        absences_deduction: absencesDeduction,
        net_pay: netPay,
        status: period.status,
        payment_date: period.payment_date,
      });

      if (error) {
        throw new Error(`Payroll failed for ${employee.name}: ${error.message}`);
      }
    }

    console.log(`  OK payroll: ${employee.name} (${isDeployed ? 'deployed' : 'floating'})`);
  }
}

async function insertBillings(clientsByCompany) {
  console.log('\nCreating billing records...');

  for (const [company, billings] of Object.entries(billingBlueprints)) {
    const client = clientsByCompany[company];

    if (!client) {
      throw new Error(`Client not found for billing: ${company}`);
    }

    for (const billing of billings) {
      const { error } = await supabase.from('billings').insert({
        client_id: client.id,
        period_start: billing.period_start,
        period_end: billing.period_end,
        total_amount: billing.total_amount,
        amount_paid: billing.amount_paid,
        balance_due: billing.balance_due,
        due_date: billing.due_date,
        status: billing.status,
        payment_date: billing.payment_date,
        payment_reference: billing.payment_reference,
      });

      if (error) {
        throw new Error(`Billing failed for ${company}: ${error.message}`);
      }
    }

    console.log(`  OK billing set: ${company}`);
  }
}

async function insertServiceTickets(clientsByCompany, employeesByEmail, sitesByKey) {
  console.log('\nCreating service tickets...');

  for (const [company, tickets] of Object.entries(ticketBlueprints)) {
    const client = clientsByCompany[company];

    if (!client) {
      throw new Error(`Client not found for tickets: ${company}`);
    }

    for (const ticket of tickets) {
      let assignedTo = null;
      if (ticket.assigned_to_email) {
        const employee = employeesByEmail[ticket.assigned_to_email];
        if (!employee) {
          throw new Error(`Assigned employee not found for ticket: ${ticket.assigned_to_email}`);
        }
        assignedTo = employee.employee_id;
      }

      let siteId = null;
      if (ticket.site_name) {
        const site = sitesByKey[`${company}::${ticket.site_name}`];
        if (!site) {
          throw new Error(`Site not found for ticket: ${company} / ${ticket.site_name}`);
        }
        siteId = site.id;
      }

      const { error } = await supabase.from('service_tickets').insert({
        client_id: client.id,
        site_id: siteId,
        ticket_type: ticket.ticket_type,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        assigned_to: assignedTo,
        resolution_notes: ticket.resolution_notes,
        created_at: ticket.created_at,
        resolved_at: ticket.resolved_at,
      });

      if (error) {
        throw new Error(`Ticket failed for ${company}: ${error.message}`);
      }
    }

    console.log(`  OK ticket set: ${company}`);
  }
}

async function seed() {
  console.log('Starting deployment seed...\n');

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, company, rate_per_guard, billing_type');

  if (clientsError || !clients || clients.length === 0) {
    throw new Error('No clients found. Please run seed_users.js first.');
  }

  const { data: employeeProfiles, error: employeesError } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      contact_email,
      employees (
        id,
        position,
        base_salary
      )
    `)
    .eq('role', 'employee');

  if (employeesError || !employeeProfiles || employeeProfiles.length === 0) {
    throw new Error('No employees found. Please run seed_users.js first.');
  }

  const normalizedEmployees = employeeProfiles
    .map((profile) => {
      const employee = Array.isArray(profile.employees) ? profile.employees[0] : profile.employees;
      if (!employee) return null;

      return {
        profile_id: profile.id,
        employee_id: employee.id,
        contact_email: profile.contact_email,
        name: `${profile.first_name} ${profile.last_name}`,
        position: employee.position,
        base_salary: employee.base_salary,
      };
    })
    .filter(Boolean);

  const clientsByCompany = byKey(clients, 'company');
  const employeesByEmail = byKey(normalizedEmployees, 'contact_email');

  console.log(`Found ${clients.length} clients and ${normalizedEmployees.length} employees.`);

  const createdSites = await insertClientSites(clientsByCompany);
  const sitesByKey = createdSites.reduce((acc, site) => {
    const client = clients.find((row) => row.id === site.client_id);
    acc[`${client.company}::${site.site_name}`] = site;
    return acc;
  }, {});

  await insertDeploymentsAndAttendance(employeesByEmail, sitesByKey);
  await insertPayroll(employeesByEmail);
  await insertBillings(clientsByCompany);
  await insertServiceTickets(clientsByCompany, employeesByEmail, sitesByKey);

  console.log('\nDeployment seed complete.');
}

seed().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
