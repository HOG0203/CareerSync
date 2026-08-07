const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSchema() {
  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching students:', error);
    return;
  }

  if (students && students.length > 0) {
    console.log('Available columns in DB:', Object.keys(students[0]));
  }
}

inspectSchema();
