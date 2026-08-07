const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testG3EmploymentStatus() {
  const { data: students, error } = await supabase
    .from('students')
    .select('id, student_name, graduation_year, student_employments(employment_status)')
    .eq('graduation_year', 2027);

  if (error) {
    console.error(error);
    return;
  }

  const counts = {};
  students.forEach(s => {
    const rawEmp = Array.isArray(s.student_employments) ? s.student_employments[0] : s.student_employments;
    const status = rawEmp?.employment_status || '미설정';
    counts[status] = (counts[status] || 0) + 1;
  });

  console.log('=== 3학년 (2027년 졸업예정자) 취업 현황 진로코스(employment_status) 집계 ===');
  console.log(JSON.stringify(counts, null, 2));
}

testG3EmploymentStatus();
