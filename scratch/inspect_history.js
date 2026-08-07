const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAcademicHistory() {
  const { data, error } = await supabase
    .from('student_academic_history')
    .select('*, students(student_name)')
    .limit(20);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Sample rows from student_academic_history:');
  console.log(JSON.stringify(data, null, 2));
}

inspectAcademicHistory();
