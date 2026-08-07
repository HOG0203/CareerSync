const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAuditTables() {
  const { data: auditTest, error: auditErr } = await supabase.from('audit_logs').select('*').limit(1);
  console.log('audit_logs check:', auditErr ? auditErr.message : 'Table exists');

  const { data: snapTest, error: snapErr } = await supabase.from('academic_history_snapshots').select('*').limit(1);
  console.log('academic_history_snapshots check:', snapErr ? snapErr.message : 'Table exists');
}

checkAuditTables();
