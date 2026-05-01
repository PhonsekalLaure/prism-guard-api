/**
 * Seed script for users (auth.users + profiles + employees/clients).
 *
 * Creates:
 *   - 4 admins
 *   - 10 employees
 *   - 5 clients
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 *
 * Usage:
 *   node src/web/seeds/seed_users.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { uploadBufferToCloudinary } = require('../../config/cloudinary');
const { isValidAdminRole } = require('../utils/adminPermissions');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_PASSWORD = 'PrismGuard2026!';
const SEED_DIRECTORY = __dirname;
const DEFAULT_CLEARANCE_TYPES = [
  'valid_id',
  'resume',
  'barangay',
  'police',
  'nbi',
  'neuro',
  'drugtest',
  'sg_license',
];
const uploadedSeedAssetUrls = new Map();

const employeeSeedDetails = {
  'marco.santos@prismguard.com': {
    suffix: 'Jr.',
    residential_address: '1782 Adriatico Street, Malate, Manila City',
    provincial_address: 'Pandi, Bulacan',
    place_of_birth: 'Manila City',
    blood_type: 'O+',
    emergency_contact_relationship: 'Mother',
    citizenship: 'Filipino',
    badge_number: 'BG-24001',
    license_number: 'SG-2026-0001',
    license_expiry_date: '2027-08-15',
    latitude: 14.5678,
    longitude: 120.9874,
    contract_end_date: '2027-03-14',
    contract_rate_per_guard: 26250,
  },
  'jose.delacruz@prismguard.com': {
    residential_address: '9037 Leveriza Street, Malate, Manila City',
    provincial_address: 'San Jose Del Monte, Bulacan',
    place_of_birth: 'Paranaque City',
    blood_type: 'A+',
    emergency_contact_relationship: 'Spouse',
    citizenship: 'Filipino',
    badge_number: 'BG-24002',
    license_number: 'SG-2026-0002',
    license_expiry_date: '2027-09-10',
    latitude: 14.5609,
    longitude: 120.9966,
    contract_end_date: '2027-07-03',
    contract_rate_per_guard: 23800,
  },
  'daniel.garcia@prismguard.com': {
    residential_address: '1543 A. Mabini Street, Ermita, Manila City',
    provincial_address: 'Rosario, Cavite',
    place_of_birth: 'Manila City',
    blood_type: 'B+',
    emergency_contact_relationship: 'Sister',
    citizenship: 'Filipino',
    badge_number: 'BG-24003',
    license_number: 'SG-2026-0003',
    license_expiry_date: '2027-11-30',
    latitude: 14.5822,
    longitude: 120.9798,
    contract_end_date: '2026-11-22',
    contract_rate_per_guard: 27500,
  },
  'miguel.ramos@prismguard.com': {
    residential_address: '72 Kabihasnan Road, San Dionisio, Paranaque City',
    provincial_address: 'Balayan, Batangas',
    place_of_birth: 'Paranaque City',
    blood_type: 'AB+',
    emergency_contact_relationship: 'Mother',
    citizenship: 'Filipino',
    badge_number: 'BG-24004',
    license_number: 'SG-2026-0004',
    license_expiry_date: '2028-02-01',
    latitude: 14.4872,
    longitude: 120.9968,
    contract_end_date: '2027-01-08',
    contract_rate_per_guard: 26250,
  },
  'rafael.bautista@prismguard.com': {
    residential_address: '1146 Quirino Avenue, Paco, Manila City',
    provincial_address: 'Guiguinto, Bulacan',
    place_of_birth: 'Manila City',
    blood_type: 'O-',
    emergency_contact_relationship: 'Spouse',
    citizenship: 'Filipino',
    badge_number: 'BG-24005',
    license_number: 'SG-2026-0005',
    license_expiry_date: '2028-04-20',
    latitude: 14.5794,
    longitude: 120.9991,
    contract_end_date: '2027-02-11',
    contract_rate_per_guard: 24500,
  },
  'adrian.fernandez@prismguard.com': {
    residential_address: '24 NAIA Road, Don Galo, Paranaque City',
    provincial_address: 'Imus, Cavite',
    place_of_birth: 'Paranaque City',
    blood_type: 'A-',
    emergency_contact_relationship: 'Spouse',
    citizenship: 'Filipino',
    badge_number: 'BG-24006',
    license_number: 'SG-2026-0006',
    license_expiry_date: '2027-12-12',
    latitude: 14.5073,
    longitude: 120.9937,
    contract_end_date: '2026-08-18',
    contract_rate_per_guard: 27500,
  },
  'paolo.lim@prismguard.com': {
    residential_address: '41 Dona Soledad Avenue, Better Living, Paranaque City',
    provincial_address: 'Silang, Cavite',
    place_of_birth: 'Manila City',
    blood_type: 'B-',
    emergency_contact_relationship: 'Sister',
    citizenship: 'Filipino',
    badge_number: 'BG-24007',
    license_number: 'SG-2026-0007',
    license_expiry_date: '2027-10-05',
    latitude: 14.4879,
    longitude: 121.0412,
    contract_end_date: '2027-10-10',
    contract_rate_per_guard: 23800,
  },
  'kevin.tan@prismguard.com': {
    residential_address: '658 P. Ocampo Street, Malate, Manila City',
    provincial_address: 'Tanza, Cavite',
    place_of_birth: 'Paranaque City',
    blood_type: 'O+',
    emergency_contact_relationship: 'Spouse',
    citizenship: 'Filipino',
    badge_number: 'BG-24008',
    license_number: 'SG-2026-0008',
    license_expiry_date: '2028-06-30',
    latitude: 14.5634,
    longitude: 120.9941,
    contract_end_date: '2027-06-25',
    contract_rate_per_guard: 22800,
  },
  'james.navarro@prismguard.com': {
    residential_address: '1020 Blumentritt Road, Sampaloc, Manila City',
    provincial_address: 'Baliwag, Bulacan',
    place_of_birth: 'Manila City',
    blood_type: 'AB-',
    emergency_contact_relationship: 'Mother',
    citizenship: 'Filipino',
    badge_number: 'BG-24009',
    license_number: 'SG-2026-0009',
    license_expiry_date: '2027-07-22',
    latitude: 14.6161,
    longitude: 120.9923,
    contract_end_date: '2027-04-17',
    contract_rate_per_guard: 24500,
  },
  'carlos.aquino@prismguard.com': {
    suffix: 'Sr.',
    residential_address: '15 Merville Access Road, Merville, Paranaque City',
    provincial_address: 'Naic, Cavite',
    place_of_birth: 'Paranaque City',
    blood_type: 'A+',
    emergency_contact_relationship: 'Spouse',
    citizenship: 'Filipino',
    badge_number: 'BG-24010',
    license_number: 'SG-2026-0010',
    license_expiry_date: '2027-05-28',
    latitude: 14.4945,
    longitude: 121.0187,
    contract_end_date: '2027-05-27',
    contract_rate_per_guard: 26250,
  },
};

const clientSeedDetails = {
  'fernando.sy@goldenpacific.ph': {
    avatar_key: 'client-avatar-1',
    billing_address: 'Aseana Square, Bradco Avenue, Tambo, Paranaque City',
  },
  'patricia.chua@metroedge.ph': {
    avatar_key: 'client-avatar-2',
    billing_address: 'Sucat Interchange Corporate Center, Dr. A. Santos Avenue, Paranaque City',
  },
  'roberto.ang@sunrisemall.ph': {
    avatar_key: 'client-avatar-3',
    billing_address: 'UN Avenue Commercial Center, Ermita, Manila City',
  },
  'diana.ong@vistahomes.ph': {
    avatar_key: 'client-avatar-4',
    billing_address: 'Ninoy Aquino Avenue Business Park, Don Galo, Paranaque City',
  },
  'henry.lao@primetech.ph': {
    avatar_key: 'client-avatar-5',
    billing_address: 'Aseana One, Diosdado Macapagal Boulevard, Paranaque City',
  },
};

const admins = [
  {
    first_name: 'Ricardo',
    middle_name: 'Luna',
    last_name: 'Mendoza',
    contact_email: 'ricardo.mendoza@prismguard.com',
    phone_number: '+639171000001',
    role: 'admin',
    admin_role: 'president',
    position: 'President',
    hire_date: '2019-04-08',
  },
  {
    first_name: 'Carmen',
    middle_name: 'De Leon',
    last_name: 'Villanueva',
    contact_email: 'carmen.villanueva@prismguard.com',
    phone_number: '+639171000002',
    role: 'admin',
    admin_role: 'operations_manager',
    position: 'Operations Manager',
    hire_date: '2020-09-14',
  },
  {
    first_name: 'Miguel',
    middle_name: 'Torres',
    last_name: 'Navarro',
    contact_email: 'miguel.navarro@prismguard.com',
    phone_number: '+639171000003',
    role: 'admin',
    admin_role: 'finance_manager',
    position: 'Finance Manager',
    hire_date: '2021-06-07',
  },
  {
    first_name: 'Angela',
    middle_name: 'Cruz',
    last_name: 'Reyes',
    contact_email: 'angela.reyes@prismguard.com',
    phone_number: '+639171000004',
    role: 'admin',
    admin_role: 'secretary',
    position: 'Secretary',
    hire_date: '2022-02-21',
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
    hire_date: '2021-03-15',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-000',
    sss_number: '04-1234567-8',
    philhealth_number: '12-345678901-2',
    pagibig_number: '1234-5678-9012',
    date_of_birth: '1990-05-15',
    gender: 'Male',
    civil_status: 'Single',
    educational_level: 'College Graduate',
    height_cm: 172,
    residential_address: '123 Sampaguita St, Quezon City',
    emergency_contact_name: 'Maria Santos',
    emergency_contact_number: '+639172000099',
    avatar_url: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
  },
  {
    first_name: 'Jose',
    middle_name: 'Pena',
    last_name: 'Dela Cruz',
    contact_email: 'jose.delacruz@prismguard.com',
    phone_number: '+639172000002',
    position: 'Security Guard',
    hire_date: '2022-07-04',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-001',
    sss_number: '04-1234567-9',
    philhealth_number: '12-345678901-3',
    pagibig_number: '1234-5678-9013',
    date_of_birth: '1992-08-22',
    gender: 'Male',
    civil_status: 'Married',
    educational_level: 'High School',
    height_cm: 168,
    residential_address: '456 Narra St, Manila',
    emergency_contact_name: 'Ana Dela Cruz',
    emergency_contact_number: '+639172000088',
    avatar_url: null,
  },
  {
    first_name: 'Daniel',
    middle_name: 'Ramos',
    last_name: 'Garcia',
    contact_email: 'daniel.garcia@prismguard.com',
    phone_number: '+639172000003',
    position: 'Security Guard',
    hire_date: '2020-11-23',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-002',
    sss_number: '04-1234567-0',
    philhealth_number: '12-345678901-4',
    pagibig_number: '1234-5678-9014',
    date_of_birth: '1985-11-10',
    gender: 'Male',
    civil_status: 'Widowed',
    educational_level: 'Vocational',
    height_cm: 175,
    residential_address: '789 Mabini St, Makati',
    emergency_contact_name: 'Elena Garcia',
    emergency_contact_number: '+639172000077',
    avatar_url: null,
  },
  {
    first_name: 'Miguel',
    middle_name: 'Soriano',
    last_name: 'Ramos',
    contact_email: 'miguel.ramos@prismguard.com',
    phone_number: '+639172000004',
    position: 'Security Guard',
    hire_date: '2023-01-09',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'reliever',
    tin_number: '123-456-789-003',
    sss_number: '04-1234567-1',
    philhealth_number: '12-345678901-5',
    pagibig_number: '1234-5678-9015',
    date_of_birth: '1988-02-14',
    gender: 'Male',
    civil_status: 'Single',
    educational_level: 'High School',
    height_cm: 170,
    residential_address: '321 Rizal Ave, Pasay',
    emergency_contact_name: 'Rosa Ramos',
    emergency_contact_number: '+639172000066',
    avatar_url: null,
  },
  {
    first_name: 'Rafael',
    middle_name: 'Gomez',
    last_name: 'Bautista',
    contact_email: 'rafael.bautista@prismguard.com',
    phone_number: '+639172000005',
    position: 'Security Guard',
    hire_date: '2024-02-12',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-004',
    sss_number: '04-1234567-2',
    philhealth_number: '12-345678901-6',
    pagibig_number: '1234-5678-9016',
    date_of_birth: '1995-07-30',
    gender: 'Male',
    civil_status: 'Married',
    educational_level: 'Some College',
    height_cm: 165,
    residential_address: '654 Taft Ave, Manila',
    emergency_contact_name: 'Nina Bautista',
    emergency_contact_number: '+639172000055',
    avatar_url: null,
  },
  {
    first_name: 'Adrian',
    middle_name: 'Cruz',
    last_name: 'Fernandez',
    contact_email: 'adrian.fernandez@prismguard.com',
    phone_number: '+639172000006',
    position: 'Shift Supervisor',
    hire_date: '2019-08-19',
    base_salary: 22000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-005',
    sss_number: '04-1234567-3',
    philhealth_number: '12-345678901-7',
    pagibig_number: '1234-5678-9017',
    date_of_birth: '1982-12-05',
    gender: 'Male',
    civil_status: 'Married',
    educational_level: 'College Graduate',
    height_cm: 174,
    residential_address: '987 Aurora Blvd, Quezon City',
    emergency_contact_name: 'Liza Fernandez',
    emergency_contact_number: '+639172000044',
    avatar_url: null,
  },
  {
    first_name: 'Paolo',
    middle_name: 'Reyes',
    last_name: 'Lim',
    contact_email: 'paolo.lim@prismguard.com',
    phone_number: '+639172000007',
    position: 'Security Guard',
    hire_date: '2021-10-11',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-006',
    sss_number: '04-1234567-4',
    philhealth_number: '12-345678901-8',
    pagibig_number: '1234-5678-9018',
    date_of_birth: '1991-03-18',
    gender: 'Male',
    civil_status: 'Single',
    educational_level: 'High School',
    height_cm: 169,
    residential_address: '147 Shaw Blvd, Mandaluyong',
    emergency_contact_name: 'Diana Lim',
    emergency_contact_number: '+639172000033',
    avatar_url: null,
  },
  {
    first_name: 'Kevin',
    middle_name: 'Santos',
    last_name: 'Tan',
    contact_email: 'kevin.tan@prismguard.com',
    phone_number: '+639172000008',
    position: 'Security Guard',
    hire_date: '2023-06-26',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-007',
    sss_number: '04-1234567-5',
    philhealth_number: '12-345678901-9',
    pagibig_number: '1234-5678-9019',
    date_of_birth: '1993-09-25',
    gender: 'Male',
    civil_status: 'Married',
    educational_level: 'Vocational',
    height_cm: 171,
    residential_address: '258 Ortigas Ave, Pasig',
    emergency_contact_name: 'Marie Tan',
    emergency_contact_number: '+639172000022',
    avatar_url: null,
  },
  {
    first_name: 'James',
    middle_name: 'Villanueva',
    last_name: 'Navarro',
    contact_email: 'james.navarro@prismguard.com',
    phone_number: '+639172000009',
    position: 'Security Guard',
    hire_date: '2022-04-18',
    base_salary: 18000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-008',
    sss_number: '04-1234567-6',
    philhealth_number: '12-345678901-0',
    pagibig_number: '1234-5678-9020',
    date_of_birth: '1987-04-12',
    gender: 'Male',
    civil_status: 'Single',
    educational_level: 'High School',
    height_cm: 167,
    residential_address: '369 EDSA, Caloocan',
    emergency_contact_name: 'Susan Navarro',
    emergency_contact_number: '+639172000011',
    avatar_url: null,
  },
  {
    first_name: 'Carlos',
    middle_name: 'Mendoza',
    last_name: 'Aquino',
    contact_email: 'carlos.aquino@prismguard.com',
    phone_number: '+639172000010',
    position: 'Shift Supervisor',
    hire_date: '2018-05-28',
    base_salary: 22000,
    pay_frequency: 'semi_monthly',
    employment_type: 'regular',
    tin_number: '123-456-789-009',
    sss_number: '04-1234567-7',
    philhealth_number: '12-345678901-1',
    pagibig_number: '1234-5678-9021',
    date_of_birth: '1980-06-08',
    gender: 'Male',
    civil_status: 'Married',
    educational_level: 'Some College',
    height_cm: 173,
    residential_address: '753 Marcos Hwy, Antipolo',
    emergency_contact_name: 'Teresa Aquino',
    emergency_contact_number: '+639172000000',
    avatar_url: null,
  },
];

const clients = [
  {
    first_name: 'Fernando',
    middle_name: 'Ang',
    last_name: 'Sy',
    contact_email: 'fernando.sy@goldenpacific.ph',
    phone_number: '+639183000001',
    role: 'client',
    status: 'inactive',
    company: 'Golden Pacific Realty',
    billing_address: '25F Pacific Tower, Makati Ave, Makati City',
    contract_start_date: '2025-01-15',
    contract_end_date: '2026-01-14',
    rate_per_guard: 24500,
    billing_type: 'monthly',
  },
  {
    first_name: 'Patricia',
    middle_name: 'Lim',
    last_name: 'Chua',
    contact_email: 'patricia.chua@metroedge.ph',
    phone_number: '+639183000002',
    role: 'client',
    status: 'inactive',
    company: 'Metro Edge Logistics',
    billing_address: '88 Warehouse Rd, Pasig City',
    contract_start_date: '2025-03-01',
    contract_end_date: '2026-02-28',
    rate_per_guard: 22800,
    billing_type: 'semi_monthly',
  },
  {
    first_name: 'Roberto',
    middle_name: 'Go',
    last_name: 'Ang',
    contact_email: 'roberto.ang@sunrisemall.ph',
    phone_number: '+639183000003',
    role: 'client',
    status: 'active',
    company: 'Sunrise Mall Corp',
    billing_address: 'Sunrise Mall, Commonwealth Ave, Quezon City',
    contract_start_date: '2025-06-01',
    contract_end_date: '2026-05-31',
    rate_per_guard: 26250,
    billing_type: 'semi_monthly',
  },
  {
    first_name: 'Diana',
    middle_name: 'Tan',
    last_name: 'Ong',
    contact_email: 'diana.ong@vistahomes.ph',
    phone_number: '+639183000004',
    role: 'client',
    status: 'active',
    company: 'Vista Homes Development',
    billing_address: '12 Lakeside Dr, Taguig City',
    contract_start_date: '2025-08-01',
    contract_end_date: '2026-07-31',
    rate_per_guard: 23800,
    billing_type: 'monthly',
  },
  {
    first_name: 'Henry',
    middle_name: 'Yu',
    last_name: 'Lao',
    contact_email: 'henry.lao@primetech.ph',
    phone_number: '+639183000005',
    role: 'client',
    status: 'active',
    company: 'PrimeTech Solutions',
    billing_address: '9F Innovation Hub, BGC, Taguig City',
    contract_start_date: '2025-10-01',
    contract_end_date: '2026-09-30',
    rate_per_guard: 27500,
    billing_type: 'monthly',
  },
];

let employeeCounter = 0;
let adminCounter = 0;

function generateEmployeeId(role) {
  if (role === 'admin') {
    adminCounter += 1;
    return `AD-${String(adminCounter).padStart(5, '0')}`;
  }

  employeeCounter += 1;
  return `PG-${String(employeeCounter).padStart(5, '0')}`;
}

function addYears(dateString, years = 1) {
  const base = new Date(dateString);
  base.setFullYear(base.getFullYear() + years);
  return base.toISOString().split('T')[0];
}

async function uploadSeedAsset(cacheKey, fileName, folder) {
  const existingUrl = uploadedSeedAssetUrls.get(cacheKey);
  if (existingUrl) {
    return existingUrl;
  }

  const filePath = path.join(SEED_DIRECTORY, fileName);
  const buffer = fs.readFileSync(filePath);
  const url = await uploadBufferToCloudinary(buffer, folder, { bypassRateLimit: true });
  uploadedSeedAssetUrls.set(cacheKey, url);
  return url;
}

async function getSharedSeedAssets() {
  return {
    employeeAvatarUrl: await uploadSeedAsset(
      'employee-avatar',
      'dummy.jpg',
      'prism_guard/employees/avatars/seed'
    ),
    clientAvatarUrl: await uploadSeedAsset(
      'client-avatar',
      'dummy.jpg',
      'prism_guard/clients/avatars/seed'
    ),
    employeeDocumentUrl: await uploadSeedAsset(
      'employee-document',
      'dummy.pdf',
      'prism_guard/employees/documents/seed'
    ),
    clientContractUrl: await uploadSeedAsset(
      'client-contract',
      'dummy.pdf',
      'prism_guard/clients/contracts/seed'
    ),
  };
}

function buildEmployeeSeed(employee, seedAssets) {
  const details = employeeSeedDetails[employee.contact_email] || {};

  return {
    ...employee,
    ...details,
    avatar_url: details.avatar_url || seedAssets.employeeAvatarUrl,
    clearance_types: details.clearance_types || DEFAULT_CLEARANCE_TYPES,
    contract_end_date: details.contract_end_date || addYears(employee.hire_date, 1),
    contract_rate_per_guard: details.contract_rate_per_guard ?? null,
  };
}

function buildClientSeed(client, seedAssets) {
  const details = clientSeedDetails[client.contact_email] || {};

  return {
    ...client,
    ...details,
    avatar_url: details.avatar_url || seedAssets.clientAvatarUrl,
    contract_url: details.contract_url || seedAssets.clientContractUrl,
  };
}

async function insertEmployeeArtifacts(id, employeeData, seedAssets) {
  const issueDate = employeeData.hire_date;
  const clearancesToInsert = (employeeData.clearance_types || DEFAULT_CLEARANCE_TYPES).map((clearanceType) => {
    const expiryYears = clearanceType === 'sg_license' ? 2 : (
      ['barangay', 'police', 'nbi', 'neuro', 'drugtest'].includes(clearanceType) ? 1 : null
    );

    return {
      employee_id: id,
      clearance_type: clearanceType,
      issue_date: issueDate,
      expiry_date: expiryYears ? addYears(issueDate, expiryYears) : null,
      document_url: seedAssets.employeeDocumentUrl,
      status: 'valid',
    };
  });

  const { error: clearanceError } = await supabase.from('clearances').insert(clearancesToInsert);
  if (clearanceError) {
    throw new Error(`Clearance insert failed for ${employeeData.contact_email}: ${clearanceError.message}`);
  }

  const { error: contractError } = await supabase.from('employee_contracts').insert({
    employee_id: id,
    contract_type: 'employment',
    start_date: employeeData.hire_date,
    end_date: employeeData.contract_end_date,
    document_url: seedAssets.employeeDocumentUrl,
    salary_at_signing: employeeData.base_salary,
    rate_per_guard: employeeData.contract_rate_per_guard,
    status: 'active',
  });

  if (contractError) {
    throw new Error(`Employee contract insert failed for ${employeeData.contact_email}: ${contractError.message}`);
  }
}

async function createAuthUser(email, password) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Auth user creation failed for ${email}: ${error.message}`);
  }

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
    suffix: userData.suffix || null,
    role: userData.role || 'employee',
    admin_role: userData.role === 'admin' ? userData.admin_role : null,
    status: userData.status || 'active',
    avatar_url: userData.avatar_url || null,
  });

  if (error) {
    throw new Error(`Profile insert failed for ${userData.contact_email}: ${error.message}`);
  }
}

function assertValidProfileSeed(userData) {
  const role = userData.role || 'employee';
  const hasValidAdminRole = isValidAdminRole(userData.admin_role);

  if (role === 'admin' && !hasValidAdminRole) {
    throw new Error(
      `Invalid admin seed for ${userData.contact_email}: role=admin requires a valid admin_role`
    );
  }

  if (role !== 'admin' && userData.admin_role != null) {
    throw new Error(
      `Invalid non-admin seed for ${userData.contact_email}: admin_role must be null`
    );
  }
}

async function seed() {
  console.log('Starting user seed...\n');
  console.log('Uploading shared seed assets...');
  const seedAssets = await getSharedSeedAssets();
  console.log('  OK shared seed assets uploaded.');

  console.log('Seeding admins...');
  for (const admin of admins) {
    assertValidProfileSeed(admin);
    const id = await createAuthUser(admin.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, admin);

    const { error } = await supabase.from('employees').insert({
      id,
      employee_id_number: generateEmployeeId('admin'),
      position: admin.position,
      hire_date: admin.hire_date,
      base_salary: null,
      pay_frequency: null,
      employment_type: 'regular',
    });

    if (error) {
      throw new Error(`Employee insert failed for ${admin.contact_email}: ${error.message}`);
    }

    console.log(`  OK admin: ${admin.position} - ${admin.first_name} ${admin.last_name}`);
  }

  console.log('\nSeeding employees...');
  for (const emp of employees) {
    const seededEmployee = buildEmployeeSeed(emp, seedAssets);
    assertValidProfileSeed({ ...seededEmployee, role: 'employee' });
    const id = await createAuthUser(emp.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, { ...seededEmployee, role: 'employee' });

    const { error } = await supabase.from('employees').insert({
      id,
      employee_id_number: generateEmployeeId('employee'),
      position: seededEmployee.position,
      hire_date: seededEmployee.hire_date,
      base_salary: seededEmployee.base_salary,
      pay_frequency: seededEmployee.pay_frequency,
      employment_type: seededEmployee.employment_type || 'regular',
      tin_number: seededEmployee.tin_number || null,
      sss_number: seededEmployee.sss_number || null,
      philhealth_number: seededEmployee.philhealth_number || null,
      pagibig_number: seededEmployee.pagibig_number || null,
      date_of_birth: seededEmployee.date_of_birth || null,
      gender: seededEmployee.gender || null,
      civil_status: seededEmployee.civil_status || null,
      citizenship: seededEmployee.citizenship || 'Filipino',
      educational_level: seededEmployee.educational_level || null,
      height_cm: seededEmployee.height_cm || null,
      residential_address: seededEmployee.residential_address || null,
      provincial_address: seededEmployee.provincial_address || null,
      place_of_birth: seededEmployee.place_of_birth || null,
      blood_type: seededEmployee.blood_type || null,
      emergency_contact_name: seededEmployee.emergency_contact_name || null,
      emergency_contact_number: seededEmployee.emergency_contact_number || null,
      emergency_contact_relationship: seededEmployee.emergency_contact_relationship || null,
      badge_number: seededEmployee.badge_number || null,
      license_number: seededEmployee.license_number || null,
      license_expiry_date: seededEmployee.license_expiry_date || null,
      latitude: seededEmployee.latitude ?? null,
      longitude: seededEmployee.longitude ?? null,
    });

    if (error) {
      throw new Error(`Employee insert failed for ${emp.contact_email}: ${error.message}`);
    }

    await insertEmployeeArtifacts(id, seededEmployee, seedAssets);

    console.log(`  OK employee: ${emp.position} - ${emp.first_name} ${emp.last_name}`);
  }

  console.log('\nSeeding clients...');
  for (const client of clients) {
    const seededClient = buildClientSeed(client, seedAssets);
    assertValidProfileSeed(seededClient);
    const id = await createAuthUser(client.contact_email, DEFAULT_PASSWORD);
    await insertProfile(id, seededClient);

    const { error } = await supabase.from('clients').insert({
      id,
      company: seededClient.company,
      billing_address: seededClient.billing_address,
      contract_start_date: seededClient.contract_start_date,
      contract_end_date: seededClient.contract_end_date,
      rate_per_guard: seededClient.rate_per_guard,
      billing_type: seededClient.billing_type,
      contract_url: seededClient.contract_url,
    });

    if (error) {
      throw new Error(`Client insert failed for ${client.contact_email}: ${error.message}`);
    }

    console.log(`  OK client: ${client.company} - ${client.first_name} ${client.last_name}`);
  }

  console.log('\nSeed complete.');
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
}

seed().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
