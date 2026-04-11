-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.client_sites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL,
  site_name text NOT NULL,
  site_address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  geofence_radius_meters integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT client_sites_pkey PRIMARY KEY (id),
  CONSTRAINT client_sites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL,
  company text,
  billing_address text,
  contract_start_date date,
  contract_end_date date,
  company_logo_url text,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.deployments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  site_id uuid NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT deployments_pkey PRIMARY KEY (id),
  CONSTRAINT deployments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT deployments_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.client_sites(id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL,
  employee_id_number text NOT NULL UNIQUE,
  position text NOT NULL,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  base_salary numeric,
  pay_frequency text,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id)
);
CREATE TABLE public.incidents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL,
  site_id uuid NOT NULL,
  raw_text text NOT NULL,
  parsed_data jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.employees(id),
  CONSTRAINT incidents_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.client_sites(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  contact_email text NOT NULL,
  phone_number text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'employee'::user_role,
  status USER-DEFINED NOT NULL DEFAULT 'active'::user_status,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);