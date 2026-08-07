const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCounselingLogs() {
  const { data, error } = await supabase.from('student_counseling_logs').select('*').limit(5);
  if (error) {
    console.error('Error fetching student_counseling_logs:', error);
    return;
  }
  console.log('Columns in student_counseling_logs:');
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log('Sample row:', data[0]);
  } else {
    console.log('No rows in student_counseling_logs');
  }
}

inspectCounselingLogs();
