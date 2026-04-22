/**
 * Seed script for Guard Deployments.
 *
 * Creates:
 *   - Client Sites for existing clients
 *   - Deployments for a subset of existing employees (guards)
 *   - Schedules for those deployments
 *   - Attendance logs for today (for stats on EmployeesPage)
 *   - Payroll Records for those guards
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
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

async function seed() {
  console.log('🚀 Starting deployment seed...\n');

  // 1. Fetch Clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, company');

  if (clientsError || !clients.length) {
    throw new Error('No clients found. Please run seed_users.js first.');
  }

  // 2. Fetch Employees (excluding admins who might not have basic_pay or role=employee)
  const { data: employeesData, error: empError } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      role,
      employees (
        id,
        position,
        base_salary
      )
    `)
    .eq('role', 'employee');

  if (empError || !employeesData.length) {
    throw new Error('No employees found. Please run seed_users.js first.');
  }

  // Filter to only get actual employees with an employee record
  const guards = employeesData
    .filter(p => {
      const emp = Array.isArray(p.employees) ? p.employees[0] : p.employees;
      return emp != null;
    })
    .map(p => {
      const emp = Array.isArray(p.employees) ? p.employees[0] : p.employees;
      return {
        profile_id: p.id,
        employee_id: emp.id,
        name: `${p.first_name} ${p.last_name}`,
        position: emp.position,
        base_salary: emp.base_salary || 18000
      };
    });

  if (guards.length === 0) {
    throw new Error('No valid employee records found.');
  }

  console.log(`Found ${clients.length} clients and ${guards.length} guards.`);

  // 3. Create Sites
  console.log('\n🏗️  Creating client sites...');
  const sites = [];
  const siteTemplates = [
    { name: 'Main HQ', lat: 14.5547, lng: 121.0244, address: 'Makati CBD' },
    { name: 'Warehouse A', lat: 14.5826, lng: 121.0634, address: 'Pasig Industrial Park' },
    { name: 'Mall Perimeter', lat: 14.6508, lng: 121.0315, address: 'QC Commonwealth' }
  ];

  for (let i = 0; i < Math.min(clients.length, siteTemplates.length); i++) {
    const client = clients[i];
    const template = siteTemplates[i];

    const { data: site, error } = await supabase.from('client_sites').insert({
      client_id: client.id,
      site_name: `${client.company} - ${template.name}`,
      site_address: template.address,
      latitude: template.lat,
      longitude: template.lng,
      geofence_radius_meters: 100,
      is_active: true
    }).select().single();

    if (error) throw new Error(`Site creation failed: ${error.message}`);
    sites.push(site);
    console.log(`   ✓ Site created: ${site.site_name}`);
  }

  // 4. Create Deployments & Schedules (Deploy 6 out of 10 guards)
  console.log('\n🛡️  Deploying guards and creating schedules...');
  
  const deployedGuards = guards.slice(0, 6); // Deploy first 6 guards
  const deployments = [];

  for (let i = 0; i < deployedGuards.length; i++) {
    const guard = deployedGuards[i];
    // Assign sites round-robin
    const site = sites[i % sites.length];

    // Deployment
    const start_date = new Date();
    start_date.setMonth(start_date.getMonth() - 1); // Started 1 month ago

    const { data: deployment, error: depError } = await supabase.from('deployments').insert({
      employee_id: guard.employee_id, // This is the UUID
      site_id: site.id,
      start_date: start_date.toISOString().split('T')[0],
      status: 'active',
      deployment_type: 'regular'
    }).select().single();

    if (depError) throw new Error(`Deployment failed for ${guard.name}: ${depError.message}`);
    deployments.push(deployment);
    console.log(`   ✓ Deployed ${guard.name} to ${site.site_name}`);

    // Schedule (Mon-Fri 08:00-17:00 or Night Shift)
    const isNightShift = i % 2 === 0;
    const shiftStart = isNightShift ? '20:00:00' : '08:00:00';
    const shiftEnd = isNightShift ? '05:00:00' : '17:00:00';
    
    // Days 1-5 (Mon-Fri) or 0-6 (All week)
    const daysArr = isNightShift ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]; 

    const { data: schedule, error: schedError } = await supabase.from('schedules').insert({
      deployment_id: deployment.id,
      days_of_week: daysArr, 
      shift_start: shiftStart,
      shift_end: shiftEnd,
      is_active: true
    }).select().single();

    if (schedError) throw new Error(`Schedule failed for ${guard.name}: ${schedError.message}`);

    // Create an attendance log for today so the Dashboard UI shows "Active on Duty" > 0
    const todayStr = new Date().toISOString().split('T')[0];
    const { error: clockError } = await supabase.from('attendance_logs').insert({
      employee_id: guard.employee_id,
      site_id: site.id,
      schedule_id: schedule.id,
      log_date: todayStr,
      clock_in: new Date().toISOString(),
      status: i % 3 === 0 ? 'late' : 'on_time'
    });
    
    if (clockError) throw new Error(`Clock-in failed for ${guard.name}: ${clockError.message}`);
  }

  // 5. Create Payroll Records
  console.log('\n💰 Generating payroll records...');
  
  const period_start = new Date();
  period_start.setDate(1); // 1st of the month
  
  const period_end = new Date();
  period_end.setDate(15); // 15th of the month

  // Generate payroll for both deployed and a couple non-deployed guards
  const guardsToPay = guards.slice(0, 8); 

  for (const guard of guardsToPay) {
    const isDeployed = deployedGuards.some(g => g.employee_id === guard.employee_id);
    const basic_pay = isDeployed ? (guard.base_salary / 2) : 0; // Half month pay if deployed, 0 if floating
    const statutory_deductions = isDeployed ? 1200 : 0; // SSS/PhilHealth/PagIBIG
    const net_pay = basic_pay - statutory_deductions;

    const { error: payError } = await supabase.from('payroll_records').insert({
      employee_id: guard.employee_id,
      period_start: period_start.toISOString().split('T')[0],
      period_end: period_end.toISOString().split('T')[0],
      basic_pay: basic_pay,
      overtime_pay: isDeployed ? 500 : 0,
      statutory_deductions: statutory_deductions,
      net_pay: net_pay + (isDeployed ? 500 : 0),
      status: 'paid',
      payment_date: period_end.toISOString().split('T')[0]
    });

    if (payError) throw new Error(`Payroll failed for ${guard.name}: ${payError.message}`);
    console.log(`   ✓ Payroll generated for ${guard.name} (${isDeployed ? 'Deployed' : 'Floating'})`);
  }

  console.log('\n✅ Deployment seed complete!');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
