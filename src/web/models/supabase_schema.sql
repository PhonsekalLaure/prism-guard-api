create table public.profiles (
  id uuid not null,
  first_name text not null,
  last_name text not null,
  contact_email text not null,
  phone_number text not null,
  role public.user_role not null default 'employee'::user_role,
  status public.user_status not null default 'active'::user_status,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  avatar_url text null,
  middle_name text null,
  deleted_at timestamp with time zone null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id)
) TABLESPACE pg_default;

create table public.employees (
  id uuid not null,
  employee_id_number text not null,
  position text not null,
  hire_date date not null default CURRENT_DATE,
  base_salary numeric null,
  pay_frequency text null,
  tin_number text null,
  sss_number text null,
  philhealth_number text null,
  pagibig_number text null,
  date_of_birth date null,
  gender text null,
  civil_status text null,
  citizenship text null default 'Filipino'::text,
  height_cm numeric null,
  educational_level text null,
  residential_address text null,
  emergency_contact_name text null,
  emergency_contact_number text null,
  employment_type text null default 'Regular'::text,
  latitude double precision null,
  longitude double precision null,
  constraint employees_pkey primary key (id),
  constraint employees_employee_id_number_key unique (employee_id_number),
  constraint employees_id_fkey foreign KEY (id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.clearances (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid null,
  clearance_type text not null,
  issue_date date not null,
  expiry_date date null,
  document_url text null,
  status text null default 'valid'::text,
  created_at timestamp with time zone null default now(),
  constraint clearances_pkey primary key (id),
  constraint clearances_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.clients (
  id uuid not null,
  company text null,
  billing_address text null,
  contract_start_date date null,
  contract_end_date date null,
  rate_per_guard numeric null,
  billing_type text null default 'semi_monthly'::text,
  constraint clients_pkey primary key (id),
  constraint clients_id_fkey foreign KEY (id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.client_sites (
  id uuid not null default extensions.uuid_generate_v4 (),
  client_id uuid not null,
  site_name text not null,
  site_address text not null,
  latitude double precision not null,
  longitude double precision not null,
  geofence_radius_meters integer not null default 50,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint client_sites_pkey primary key (id),
  constraint client_sites_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.deployments (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  site_id uuid not null,
  deployment_order_url text null,
  start_date date not null default CURRENT_DATE,
  end_date date null,
  status text null default 'active'::text,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  deployment_type text null default 'regular'::text,
  covering_for_employee_id uuid null,
  constraint deployments_pkey primary key (id),
  constraint deployments_covering_for_employee_id_fkey foreign KEY (covering_for_employee_id) references employees (id) on delete set null,
  constraint deployments_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint deployments_site_id_fkey foreign KEY (site_id) references client_sites (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.schedules (
  id uuid not null default extensions.uuid_generate_v4 (),
  deployment_id uuid not null,
  days_of_week integer[] not null,
  shift_start time without time zone not null,
  shift_end time without time zone not null,
  is_active boolean not null default true,
  created_at timestamp with time zone null default now(),
  constraint schedules_pkey primary key (id),
  constraint schedules_deployment_id_fkey foreign KEY (deployment_id) references deployments (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.attendance_logs (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  site_id uuid not null,
  schedule_id uuid null,
  log_date date not null default CURRENT_DATE,
  clock_in timestamp with time zone not null default timezone ('utc'::text, now()),
  clock_out timestamp with time zone null,
  in_latitude double precision null,
  in_longitude double precision null,
  out_latitude double precision null,
  out_longitude double precision null,
  status text null default 'on_time'::text,
  constraint attendance_logs_pkey primary key (id),
  constraint attendance_logs_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint attendance_logs_schedule_id_fkey foreign KEY (schedule_id) references schedules (id) on delete set null,
  constraint attendance_logs_site_id_fkey foreign KEY (site_id) references client_sites (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.location_pings (
  id uuid not null default extensions.uuid_generate_v4 (),
  attendance_log_id uuid not null,
  employee_id uuid not null,
  latitude double precision not null,
  longitude double precision not null,
  is_within_geofence boolean not null,
  ping_time timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint location_pings_pkey primary key (id),
  constraint location_pings_attendance_log_id_fkey foreign KEY (attendance_log_id) references attendance_logs (id) on delete CASCADE,
  constraint location_pings_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.leave_requests (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text null default 'pending'::text,
  reviewed_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint leave_requests_pkey primary key (id),
  constraint leave_requests_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint leave_requests_reviewed_by_fkey foreign KEY (reviewed_by) references profiles (id)
) TABLESPACE pg_default;

create table public.leave_balances (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  year integer not null,
  leave_type text not null,
  total_allocated numeric not null default 0,
  used_days numeric not null default 0,
  created_at timestamp with time zone null default now(),
  constraint leave_balances_pkey primary key (id),
  constraint unique_employee_year_leave unique (employee_id, year, leave_type),
  constraint leave_balances_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.cash_advances (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  amount_requested numeric not null,
  amount_approved numeric null,
  reason text not null,
  deduction_per_paycheck numeric null,
  remaining_balance numeric null,
  status text null default 'pending'::text,
  reviewed_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint cash_advances_pkey primary key (id),
  constraint cash_advances_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE,
  constraint cash_advances_reviewed_by_fkey foreign KEY (reviewed_by) references profiles (id)
) TABLESPACE pg_default;

create table public.incidents (
  id uuid not null default extensions.uuid_generate_v4 (),
  reporter_id uuid not null,
  site_id uuid not null,
  raw_text text not null,
  parsed_data jsonb null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint incidents_pkey primary key (id),
  constraint incidents_reporter_id_fkey foreign KEY (reporter_id) references employees (id) on delete CASCADE,
  constraint incidents_site_id_fkey foreign KEY (site_id) references client_sites (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.service_tickets (
  id uuid not null default extensions.uuid_generate_v4 (),
  client_id uuid not null,
  site_id uuid null,
  ticket_type text not null,
  subject text not null,
  description text not null,
  priority text null default 'normal'::text,
  status text null default 'open'::text,
  assigned_to uuid null,
  resolution_notes text null,
  created_at timestamp with time zone null default now(),
  resolved_at timestamp with time zone null,
  constraint service_tickets_pkey primary key (id),
  constraint service_tickets_assigned_to_fkey foreign KEY (assigned_to) references employees (id),
  constraint service_tickets_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint service_tickets_site_id_fkey foreign KEY (site_id) references client_sites (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.billings (
  id uuid not null default extensions.uuid_generate_v4 (),
  client_id uuid not null,
  period_start date not null,
  period_end date not null,
  total_amount numeric not null,
  amount_paid numeric null default 0,
  balance_due numeric not null,
  due_date date not null,
  status text not null default 'unpaid'::text,
  payment_date date null,
  payment_reference text null,
  created_at timestamp with time zone null default now(),
  constraint billings_pkey primary key (id),
  constraint billings_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.payroll_records (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  period_start date not null,
  period_end date not null,
  basic_pay numeric not null,
  overtime_pay numeric null default 0,
  holiday_pay numeric null default 0,
  statutory_deductions numeric null default 0,
  cash_advance_deduction numeric null default 0,
  absences_deduction numeric null default 0,
  net_pay numeric not null,
  status text not null default 'draft'::text,
  payment_date date null,
  created_at timestamp with time zone null default now(),
  constraint payroll_records_pkey primary key (id),
  constraint payroll_records_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.payroll_records (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  period_start date not null,
  period_end date not null,
  basic_pay numeric not null,
  overtime_pay numeric null default 0,
  holiday_pay numeric null default 0,
  statutory_deductions numeric null default 0,
  cash_advance_deduction numeric null default 0,
  absences_deduction numeric null default 0,
  net_pay numeric not null,
  status text not null default 'draft'::text,
  payment_date date null,
  created_at timestamp with time zone null default now(),
  constraint payroll_records_pkey primary key (id),
  constraint payroll_records_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;