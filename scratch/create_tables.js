const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      actor_id UUID,
      actor_name TEXT,
      action_type TEXT NOT NULL,
      target_name TEXT,
      details JSONB,
      ip_address TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.academic_history_snapshots (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      base_year INT NOT NULL,
      snapshot_name TEXT NOT NULL,
      student_count INT DEFAULT 0,
      snapshot_data JSONB NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `;

  // Try calling exec_sql or query if available
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log('RPC exec_sql not available:', error.message);
  } else {
    console.log('Tables created via exec_sql successfully!');
  }
}

createTables();
