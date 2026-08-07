const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectEmpSchema() {
  const { data, error } = await supabase.from('student_employments').select('*').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in student_employments:', Object.keys(data[0]));
    console.log('Sample row:', data[0]);
  }
}

inspectEmpSchema();
