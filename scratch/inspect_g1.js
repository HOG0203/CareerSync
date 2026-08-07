const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectG1Rows() {
  const { data: records } = await supabase
    .from('student_academic_history')
    .select('*, students(student_name, graduation_year)')
    .eq('major', '친환경자동차과')
    .eq('class_info', '1');

  records.filter(r => r.students?.graduation_year === 2029).slice(0, 5).forEach(r => {
    console.log(`Student: ${r.students?.student_name}, h.grade: ${r.grade}, h.academic_year: ${r.academic_year}, teacher: ${r.teacher_name}`);
  });
}

inspectG1Rows();
