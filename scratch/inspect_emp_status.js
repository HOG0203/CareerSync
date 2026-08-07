const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectEmployments() {
  const { data: employments, error } = await supabase
    .from('student_employments')
    .select('student_id, business_type, company_type, employment_status, students!inner(graduation_year, student_name, major, class_info)');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total student_employments records: ${employments.length}`);

  const countsByYear = {};
  employments.forEach(e => {
    const gy = e.students?.graduation_year || 'NULL';
    if (!countsByYear[gy]) countsByYear[gy] = {};
    const status = e.employment_status || 'NULL/EMPTY';
    countsByYear[gy][status] = (countsByYear[gy][status] || 0) + 1;
  });

  console.log('\n--- Distribution of employment_status in student_employments by graduation_year ---');
  console.log(JSON.stringify(countsByYear, null, 2));

  console.log('\nSample student_employments records:');
  console.log(JSON.stringify(employments.slice(0, 10), null, 2));
}

inspectEmployments();
