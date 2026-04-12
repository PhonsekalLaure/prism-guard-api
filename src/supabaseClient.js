const { createClient } = require('@supabase/supabase-js');

// Anon-key client — used for auth operations (signInWithPassword, getUser)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Service-role client — bypasses RLS, used for server-side DB queries
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabase, supabaseAdmin };

