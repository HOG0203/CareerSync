const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFK() {
  const { data, error } = await supabase.rpc('pg_get_constraintdef', {});
  // Or query information_schema / sample query
  const { data: logs } = await supabase.from('student_counseling_logs').select('id, author_id, author_name').limit(3);
  console.log('Sample counseling logs author info:', logs);
}

checkFK();
