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
    last_name: 'Mendoza',
    contact_email: 'ricardo.mendoza@prismguard.com',
    phone_number: '+639171000001',
    role: 'admin',
    position: 'President',
  },
  {
    first_name: 'Carmen',
    last_name: 'Villanueva',
    contact_email: 'carmen.villanueva@prismguard.com',
    phone_number: '+639171000002',
    role: 'admin',
    position: 'Operations Manager',
  },
  {
    first_name: 'Angela',
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
    last_name: 'Santos',
    contact_email: 'marco.santos@prismguard.com',
    phone_number: '+639172000001',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Jose',
    last_name: 'Dela Cruz',
    contact_email: 'jose.delacruz@prismguard.com',
    phone_number: '+639172000002',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Daniel',
    last_name: 'Garcia',
    contact_email: 'daniel.garcia@prismguard.com',
    phone_number: '+639172000003',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Miguel',
    last_name: 'Ramos',
    contact_email: 'miguel.ramos@prismguard.com',
    phone_number: '+639172000004',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Rafael',
    last_name: 'Bautista',
    contact_email: 'rafael.bautista@prismguard.com',
    phone_number: '+639172000005',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Adrian',
    last_name: 'Fernandez',
    contact_email: 'adrian.fernandez@prismguard.com',
    phone_number: '+639172000006',
    position: 'Shift Supervisor',
    base_salary: 22000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Paolo',
    last_name: 'Lim',
    contact_email: 'paolo.lim@prismguard.com',
    phone_number: '+639172000007',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Kevin',
    last_name: 'Tan',
    contact_email: 'kevin.tan@prismguard.com',
    phone_number: '+639172000008',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'James',
    last_name: 'Navarro',
    contact_email: 'james.navarro@prismguard.com',
    phone_number: '+639172000009',
    position: 'Security Guard',
    base_salary: 18000,
    pay_frequency: 'monthly',
  },
  {
    first_name: 'Carlos',
    last_name: 'Aquino',
    contact_email: 'carlos.aquino@prismguard.com',
    phone_number: '+639172000010',
    position: 'Shift Supervisor',
    base_salary: 22000,
    pay_frequency: 'monthly',
  },
];

const clients = [
  {
    first_name: 'Fernando',
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

function generateEmployeeId() {
  employeeCounter++;
  return `PG-${String(employeeCounter).padStart(4, '0')}`;
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
    console.log(`   ✓ ${admin.position}: ${admin.first_name} ${admin.last_name}`);
  }

  // --- Employees ---
  console.log('\n🛡️  Seeding employees...');
  for (const emp of employees) {
    const id = await createAuthUser(emp.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, { ...emp, role: 'employee' });

    const { error } = await supabase.from('employees').insert({
      id,
      employee_id_number: generateEmployeeId(),
      position: emp.position,
      hire_date: new Date().toISOString().split('T')[0],
      base_salary: emp.base_salary,
      pay_frequency: emp.pay_frequency,
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
