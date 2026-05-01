user_role = [admin, employee, client]
user_status = [active, inactive]

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
  suffix text null,
  admin_role text null,
  constraint profiles_pkey primary key (id),
  constraint profiles_contact_email_key unique (contact_email),
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
  provincial_address text null,
  place_of_birth text null,
  blood_type text null,
  emergency_contact_name text null,
  emergency_contact_number text null,
  emergency_contact_relationship text null,
  employment_type text null default 'Regular'::text,
  badge_number text null,
  license_number text null,
  license_expiry_date date null,
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
  constraint clearances_employee_clearance_type_unique unique (employee_id, clearance_type),
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
  contract_url text null,
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

create table if not exists public.employee_contracts (
  id uuid not null default extensions.uuid_generate_v4 (),
  employee_id uuid not null,
  contract_type text not null default 'employment'::text,
  start_date date not null,
  end_date date null,
  document_url text null,
  salary_at_signing numeric null,
  rate_per_guard numeric null,
  status text null default 'active'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint employee_contracts_end_after_start check (end_date is null or end_date >= start_date),
  constraint employee_contracts_pkey primary key (id),
  constraint employee_contracts_employee_id_fkey foreign KEY (employee_id) references employees (id) on delete CASCADE
) TABLESPACE pg_default;
---------------------------------------------------------------------------------------

alter table public.employee_contracts enable row level security;

-- Helpful trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists employee_contracts_set_updated_at on public.employee_contracts;
create trigger employee_contracts_set_updated_at
before update on public.employee_contracts
for each row execute function public.set_updated_at();

-- API privileges
revoke all on public.employee_contracts from public;
grant select, insert, update, delete on public.employee_contracts to authenticated;

-- RLS helper function to get user role safely
create or replace function public.get_user_role()
returns public.user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer;

-- RLS policies for employee_contracts
-- Employees can view their own contracts
create policy "Employee contracts select own" on public.employee_contracts
for select to authenticated
using (
  employee_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role
);

-- Only admins can insert, update, or delete contracts
create policy "Employee contracts admin insert" on public.employee_contracts
for insert to authenticated
with check (public.get_user_role() = 'admin'::public.user_role);

create policy "Employee contracts admin update" on public.employee_contracts
for update to authenticated
using (public.get_user_role() = 'admin'::public.user_role)
with check (public.get_user_role() = 'admin'::public.user_role);

create policy "Employee contracts admin delete" on public.employee_contracts
for delete to authenticated
using (public.get_user_role() = 'admin'::public.user_role);

create index if not exists idx_employee_contracts_employee_id on public.employee_contracts(employee_id);
create index if not exists idx_employee_contracts_dates on public.employee_contracts(employee_id, start_date, end_date);

-- ==========================================
-- ROW LEVEL SECURITY FOR ALL OTHER TABLES
-- ==========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.clearances enable row level security;
alter table public.clients enable row level security;
alter table public.client_sites enable row level security;
alter table public.deployments enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.location_pings enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.cash_advances enable row level security;
alter table public.incidents enable row level security;
alter table public.service_tickets enable row level security;
alter table public.billings enable row level security;
alter table public.payroll_records enable row level security;

-- PROFILES
create policy "Profiles select" on public.profiles for select to authenticated using (
  id = auth.uid() OR 
  public.get_user_role() = 'admin'::public.user_role OR
  (public.get_user_role() = 'client'::public.user_role AND id IN (
    select e.id from public.deployments d
    join public.employees e on d.employee_id = e.id
    join public.client_sites cs on d.site_id = cs.id
    where cs.client_id = auth.uid()
  ))
);
create policy "Profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Profiles admin all" on public.profiles for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- EMPLOYEES
create policy "Employees select" on public.employees for select to authenticated using (
  id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  (public.get_user_role() = 'client'::public.user_role AND id IN (
    select employee_id from public.deployments d
    join public.client_sites cs on d.site_id = cs.id
    where cs.client_id = auth.uid()
  ))
);
create policy "Employees update own" on public.employees for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Employees admin all" on public.employees for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- CLEARANCES
create policy "Clearances select own" on public.clearances for select to authenticated using (employee_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Clearances admin all" on public.clearances for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- CLIENTS
create policy "Clients select own" on public.clients for select to authenticated using (id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Clients admin all" on public.clients for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- CLIENT SITES
create policy "Client Sites select" on public.client_sites for select to authenticated using (
  client_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  id IN (select site_id from public.deployments where employee_id = auth.uid())
);
create policy "Client Sites update own" on public.client_sites for update to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "Client Sites admin all" on public.client_sites for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- DEPLOYMENTS
create policy "Deployments select" on public.deployments for select to authenticated using (
  employee_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  site_id IN (select id from public.client_sites where client_id = auth.uid())
);
create policy "Deployments admin all" on public.deployments for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- SCHEDULES
create policy "Schedules select" on public.schedules for select to authenticated using (
  public.get_user_role() = 'admin'::public.user_role OR
  deployment_id IN (select id from public.deployments where employee_id = auth.uid() OR site_id IN (select id from public.client_sites where client_id = auth.uid()))
);
create policy "Schedules admin all" on public.schedules for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- ATTENDANCE LOGS
create policy "Attendance logs select" on public.attendance_logs for select to authenticated using (
  employee_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  site_id IN (select id from public.client_sites where client_id = auth.uid())
);
create policy "Attendance logs insert own" on public.attendance_logs for insert to authenticated with check (employee_id = auth.uid());
create policy "Attendance logs admin all" on public.attendance_logs for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- LOCATION PINGS
create policy "Location pings select" on public.location_pings for select to authenticated using (
  employee_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  attendance_log_id IN (select id from public.attendance_logs where site_id IN (select id from public.client_sites where client_id = auth.uid()))
);
create policy "Location pings insert own" on public.location_pings for insert to authenticated with check (employee_id = auth.uid());
create policy "Location pings admin all" on public.location_pings for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- LEAVE REQUESTS
create policy "Leave requests select own" on public.leave_requests for select to authenticated using (employee_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Leave requests insert own" on public.leave_requests for insert to authenticated with check (employee_id = auth.uid());
create policy "Leave requests update own pending" on public.leave_requests for update to authenticated using (employee_id = auth.uid() AND status = 'pending') with check (employee_id = auth.uid() AND status = 'pending');
create policy "Leave requests admin all" on public.leave_requests for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- LEAVE BALANCES
create policy "Leave balances select own" on public.leave_balances for select to authenticated using (employee_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Leave balances admin all" on public.leave_balances for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- CASH ADVANCES
create policy "Cash advances select own" on public.cash_advances for select to authenticated using (employee_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Cash advances insert own" on public.cash_advances for insert to authenticated with check (employee_id = auth.uid());
create policy "Cash advances admin all" on public.cash_advances for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- INCIDENTS
create policy "Incidents select" on public.incidents for select to authenticated using (
  reporter_id = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role OR
  site_id IN (select id from public.client_sites where client_id = auth.uid())
);
create policy "Incidents insert own" on public.incidents for insert to authenticated with check (reporter_id = auth.uid());
create policy "Incidents admin all" on public.incidents for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- SERVICE TICKETS
create policy "Service tickets select" on public.service_tickets for select to authenticated using (
  client_id = auth.uid() OR
  assigned_to = auth.uid() OR
  public.get_user_role() = 'admin'::public.user_role
);
create policy "Service tickets insert own" on public.service_tickets for insert to authenticated with check (client_id = auth.uid());
create policy "Service tickets admin all" on public.service_tickets for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- BILLINGS
create policy "Billings select own" on public.billings for select to authenticated using (client_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Billings admin all" on public.billings for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

-- PAYROLL RECORDS
create policy "Payroll records select own" on public.payroll_records for select to authenticated using (employee_id = auth.uid() OR public.get_user_role() = 'admin'::public.user_role);
create policy "Payroll records admin all" on public.payroll_records for all to authenticated using (public.get_user_role() = 'admin'::public.user_role) with check (public.get_user_role() = 'admin'::public.user_role);

