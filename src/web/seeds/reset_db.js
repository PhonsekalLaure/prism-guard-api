require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Service-role client — bypasses RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetDatabase() {
  console.log('🧹 Starting database reset...\n');

  try {
    // 1. Delete dependent tables first due to foreign key constraints
    console.log('Clearing core tables...');
    await supabase.from('incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('deployments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('client_sites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✅ Core tables cleared.');

    // 2. Fetch and delete all users in auth.users
    console.log('\nFetching auth users from Supabase...');
    // listUsers handles pagination, but typically defaults to 50 at a time.
    // We can loop to ensure we fetch and delete them all.
    let hasMore = true;
    let page = 1;
    let totalDeleted = 0;

    while (hasMore) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 100,
      });

      if (error) {
        throw new Error(`Failed to fetch auth users: ${error.message}`);
      }

      if (data.users.length === 0) {
        hasMore = false;
        break;
      }

      for (const user of data.users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`❌ Failed to delete auth user ${user.email}: ${deleteError.message}`);
        } else {
          totalDeleted++;
        }
      }

      // If we got exactly what we asked for, there might be more
      if (data.users.length < 100) {
        hasMore = false;
      }
      
      // If we are deleting them, we might not need to increment page 
      // because the pool shrinks, but keeping it as page=1 implies we 
      // just fetch the first page again until empty.
      // So we don't increment `page` if we're aggressively deleting the first page each time.
    }

    console.log(`\n✅ Database reset complete! ${totalDeleted} auth users deleted.`);

  } catch (err) {
    console.error('\n❌ Reset failed:', err.message);
    process.exit(1);
  }
}

resetDatabase();
