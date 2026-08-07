const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectLogs() {
  const { count, error } = await supabase
    .from('student_counseling_logs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(error);
    return;
  }
  console.log(`Current total student_counseling_logs count: ${count}`);
}

inspectLogs();
