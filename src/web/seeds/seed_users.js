/**
 * Seed script for users (auth.users + profiles + employees/clients).
 *
 * Creates:
 *   - 3 admins  (president, operations manager, secretary)
 *   - 10 employees (security guards)
 *   - 5 clients
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (for auth.admin).
 *
 * Usage:
 *   node src/web/seeds/seed_users.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Service-role client — bypasses RLS and can create auth users
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Seed Data ───────────────────────────────────────────────

const DEFAULT_PASSWORD = 'PrismGuard2026!';

const admins = [
  {
    first_name: 'Ricardo',
    middle_name: 'Luna',
    last_name: 'Mendoza',
    contact_email: 'ricardo.mendoza@prismguard.com',
    phone_number: '+639171000001',
    role: 'admin',
    position: 'President',
  },
  {
    first_name: 'Carmen',
    middle_name: 'De Leon',
    last_name: 'Villanueva',
    contact_email: 'carmen.villanueva@prismguard.com',
    phone_number: '+639171000002',
    role: 'admin',
    position: 'Operations Manager',
  },
  {
    first_name: 'Angela',
    middle_name: 'Cruz',
    last_name: 'Reyes',
    contact_email: 'angela.reyes@prismguard.com',
    phone_number: '+639171000003',
    role: 'admin',
    position: 'Secretary',
  },
];

const employees = [
  {
    first_name: 'Marco',
    middle_name: 'Alonzo',
    last_name: 'Santos',
    contact_email: 'marco.santos@prismguard.com',
    phone_number: '+639172000001',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-000',
    sss_number: '04-1234567-8',
    philhealth_number: '12-345678901-2',
    pagibig_number: '1234-5678-9012',
    date_of_birth: '1990-05-15',
    gender: 'Male',
    civil_status: 'Single',
    residential_address: '123 Sampaguita St, Quezon City',
    emergency_contact_name: 'Maria Santos',
    emergency_contact_number: '+639172000099',
  },
  {
    first_name: 'Jose',
    middle_name: 'Pena',
    last_name: 'Dela Cruz',
    contact_email: 'jose.delacruz@prismguard.com',
    phone_number: '+639172000002',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-001',
    sss_number: '04-1234567-9',
    philhealth_number: '12-345678901-3',
    pagibig_number: '1234-5678-9013',
    date_of_birth: '1992-08-22',
    gender: 'Male',
    civil_status: 'Married',
    residential_address: '456 Narra St, Manila',
    emergency_contact_name: 'Ana Dela Cruz',
    emergency_contact_number: '+639172000088',
  },
  {
    first_name: 'Daniel',
    middle_name: 'Ramos',
    last_name: 'Garcia',
    contact_email: 'daniel.garcia@prismguard.com',
    phone_number: '+639172000003',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-002',
    sss_number: '04-1234567-0',
    philhealth_number: '12-345678901-4',
    pagibig_number: '1234-5678-9014',
    date_of_birth: '1985-11-10',
    gender: 'Male',
    civil_status: 'Widowed',
    residential_address: '789 Mabini St, Makati',
    emergency_contact_name: 'Elena Garcia',
    emergency_contact_number: '+639172000077',
  },
  {
    first_name: 'Miguel',
    middle_name: 'Soriano',
    last_name: 'Ramos',
    contact_email: 'miguel.ramos@prismguard.com',
    phone_number: '+639172000004',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-003',
    sss_number: '04-1234567-1',
    philhealth_number: '12-345678901-5',
    pagibig_number: '1234-5678-9015',
    date_of_birth: '1988-02-14',
    gender: 'Male',
    civil_status: 'Single',
    residential_address: '321 Rizal Ave, Pasay',
    emergency_contact_name: 'Rosa Ramos',
    emergency_contact_number: '+639172000066',
  },
  {
    first_name: 'Rafael',
    middle_name: 'Gomez',
    last_name: 'Bautista',
    contact_email: 'rafael.bautista@prismguard.com',
    phone_number: '+639172000005',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-004',
    sss_number: '04-1234567-2',
    philhealth_number: '12-345678901-6',
    pagibig_number: '1234-5678-9016',
    date_of_birth: '1995-07-30',
    gender: 'Male',
    civil_status: 'Married',
    residential_address: '654 Taft Ave, Manila',
    emergency_contact_name: 'Nina Bautista',
    emergency_contact_number: '+639172000055',
  },
  {
    first_name: 'Adrian',
    middle_name: 'Cruz',
    last_name: 'Fernandez',
    contact_email: 'adrian.fernandez@prismguard.com',
    phone_number: '+639172000006',
    position: 'Shift Supervisor',
    base_salary: 22000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-005',
    sss_number: '04-1234567-3',
    philhealth_number: '12-345678901-7',
    pagibig_number: '1234-5678-9017',
    date_of_birth: '1982-12-05',
    gender: 'Male',
    civil_status: 'Married',
    residential_address: '987 Aurora Blvd, Quezon City',
    emergency_contact_name: 'Liza Fernandez',
    emergency_contact_number: '+639172000044',
  },
  {
    first_name: 'Paolo',
    middle_name: 'Reyes',
    last_name: 'Lim',
    contact_email: 'paolo.lim@prismguard.com',
    phone_number: '+639172000007',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-006',
    sss_number: '04-1234567-4',
    philhealth_number: '12-345678901-8',
    pagibig_number: '1234-5678-9018',
    date_of_birth: '1991-03-18',
    gender: 'Male',
    civil_status: 'Single',
    residential_address: '147 Shaw Blvd, Mandaluyong',
    emergency_contact_name: 'Diana Lim',
    emergency_contact_number: '+639172000033',
  },
  {
    first_name: 'Kevin',
    middle_name: 'Santos',
    last_name: 'Tan',
    contact_email: 'kevin.tan@prismguard.com',
    phone_number: '+639172000008',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-007',
    sss_number: '04-1234567-5',
    philhealth_number: '12-345678901-9',
    pagibig_number: '1234-5678-9019',
    date_of_birth: '1993-09-25',
    gender: 'Male',
    civil_status: 'Married',
    residential_address: '258 Ortigas Ave, Pasig',
    emergency_contact_name: 'Marie Tan',
    emergency_contact_number: '+639172000022',
  },
  {
    first_name: 'James',
    middle_name: 'Villanueva',
    last_name: 'Navarro',
    contact_email: 'james.navarro@prismguard.com',
    phone_number: '+639172000009',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-008',
    sss_number: '04-1234567-6',
    philhealth_number: '12-345678901-0',
    pagibig_number: '1234-5678-9020',
    date_of_birth: '1987-04-12',
    gender: 'Male',
    civil_status: 'Single',
    residential_address: '369 EDSA, Caloocan',
    emergency_contact_name: 'Susan Navarro',
    emergency_contact_number: '+639172000011',
  },
  {
    first_name: 'Carlos',
    middle_name: 'Mendoza',
    last_name: 'Aquino',
    contact_email: 'carlos.aquino@prismguard.com',
    phone_number: '+639172000010',
    position: 'Shift Supervisor',
    base_salary: 22000,
    pay_frequency: 'monthly',
    tin_number: '123-456-789-009',
    sss_number: '04-1234567-7',
    philhealth_number: '12-345678901-1',
    pagibig_number: '1234-5678-9021',
    date_of_birth: '1980-06-08',
    gender: 'Male',
    civil_status: 'Married',
    residential_address: '753 Marcos Hwy, Antipolo',
    emergency_contact_name: 'Teresa Aquino',
    emergency_contact_number: '+639172000000',
  },
];

const clients = [
  {
    first_name: 'Fernando',
    middle_name: 'Ang',
    last_name: 'Sy',
    contact_email: 'fernando.sy@goldenpacific.ph',
    phone_number: '+639183000001',
    company: 'Golden Pacific Realty',
    billing_address: '25F Pacific Tower, Makati Ave, Makati City',
    contract_start_date: '2025-01-15',
    contract_end_date: '2026-01-14',
  },
  {
    first_name: 'Patricia',
    middle_name: 'Lim',
    last_name: 'Chua',
    contact_email: 'patricia.chua@metroedge.ph',
    phone_number: '+639183000002',
    company: 'Metro Edge Logistics',
    billing_address: '88 Warehouse Rd, Pasig City',
    contract_start_date: '2025-03-01',
    contract_end_date: '2026-02-28',
  },
  {
    first_name: 'Roberto',
    middle_name: 'Go',
    last_name: 'Ang',
    contact_email: 'roberto.ang@sunrisemall.ph',
    phone_number: '+639183000003',
    company: 'Sunrise Mall Corp',
    billing_address: 'Sunrise Mall, Commonwealth Ave, Quezon City',
    contract_start_date: '2025-06-01',
    contract_end_date: '2026-05-31',
  },
  {
    first_name: 'Diana',
    middle_name: 'Tan',
    last_name: 'Ong',
    contact_email: 'diana.ong@vistahomes.ph',
    phone_number: '+639183000004',
    company: 'Vista Homes Development',
    billing_address: '12 Lakeside Dr, Taguig City',
    contract_start_date: '2025-08-01',
    contract_end_date: '2026-07-31',
  },
  {
    first_name: 'Henry',
    middle_name: 'Yu',
    last_name: 'Lao',
    contact_email: 'henry.lao@primetech.ph',
    phone_number: '+639183000005',
    company: 'PrimeTech Solutions',
    billing_address: '9F Innovation Hub, BGC, Taguig City',
    contract_start_date: '2025-10-01',
    contract_end_date: '2026-09-30',
  },
];

// ─── Helpers ─────────────────────────────────────────────────

let employeeCounter = 0;
let adminCounter = 0;

function generateEmployeeId(role) {
  if (role === 'admin') {
    adminCounter++;
    return `AD-${String(adminCounter).padStart(5, '0')}`;
  } else {
    employeeCounter++;
    return `PG-${String(employeeCounter).padStart(5, '0')}`;
  }
}

async function createAuthUser(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) throw new Error(`Auth user creation failed for ${email}: ${error.message}`);
  return data.user.id;
}

async function insertProfile(id, userData) {
  const { error } = await supabase.from('profiles').insert({
    id,
    first_name: userData.first_name,
    middle_name: userData.middle_name || null,
    last_name: userData.last_name,
    contact_email: userData.contact_email,
    phone_number: userData.phone_number,
    role: userData.role || 'employee',
    status: 'active',
  });

  if (error) throw new Error(`Profile insert failed for ${userData.contact_email}: ${error.message}`);
}

// ─── Main Seed Function ─────────────────────────────────────

async function seed() {
  console.log('🌱 Starting user seed...\n');

  // --- Admins ---
  console.log('👔 Seeding admins...');
  for (const admin of admins) {
    const id = await createAuthUser(admin.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, admin);

    const { error } = await supabase.from('employees').insert({
      id,
      employee_id_number: generateEmployeeId('admin'),
      position: admin.position,
      hire_date: new Date().toISOString().split('T')[0],
      base_salary: null,
      pay_frequency: null,
    });

    if (error) throw new Error(`Employee insert failed for ${admin.contact_email}: ${error.message}`);
    console.log(`   ✓ ${admin.position}: ${admin.first_name} ${admin.last_name}`);
  }

  // --- Employees ---
  console.log('\n🛡️  Seeding employees...');
  for (const emp of employees) {
    const id = await createAuthUser(emp.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, { ...emp, role: 'employee' });

    const { error } = await supabase.from('employees').insert({
      id,
      employee_id_number: generateEmployeeId('employee'),
      position: emp.position,
      hire_date: new Date().toISOString().split('T')[0],
      base_salary: emp.base_salary,
      pay_frequency: emp.pay_frequency,
      tin_number: emp.tin_number || null,
      sss_number: emp.sss_number || null,
      philhealth_number: emp.philhealth_number || null,
      pagibig_number: emp.pagibig_number || null,
      date_of_birth: emp.date_of_birth || null,
      gender: emp.gender || null,
      civil_status: emp.civil_status || null,
      residential_address: emp.residential_address || null,
      emergency_contact_name: emp.emergency_contact_name || null,
      emergency_contact_number: emp.emergency_contact_number || null,
    });

    if (error) throw new Error(`Employee insert failed for ${emp.contact_email}: ${error.message}`);
    console.log(`   ✓ ${emp.position}: ${emp.first_name} ${emp.last_name}`);
  }

  // --- Clients ---
  console.log('\n🏢 Seeding clients...');
  for (const client of clients) {
    const id = await createAuthUser(client.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, { ...client, role: 'client' });

    const { error } = await supabase.from('clients').insert({
      id,
      company: client.company,
      billing_address: client.billing_address,
      contract_start_date: client.contract_start_date,
      contract_end_date: client.contract_end_date,
    });

    if (error) throw new Error(`Client insert failed for ${client.contact_email}: ${error.message}`);
    console.log(`   ✓ ${client.company}: ${client.first_name} ${client.last_name}`);
  }

  console.log('\n✅ Seed complete! 18 users created.');
  console.log(`   Default password for all users: ${DEFAULT_PASSWORD}`);
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
