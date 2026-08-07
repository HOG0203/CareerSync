const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findSeojongdong() {
  const { data: records, error } = await supabase
    .from('student_academic_history')
    .select('*, students(student_name)')
    .eq('teacher_name', '서정동');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${records.length} records with teacher_name '서정동':`);
  records.slice(0, 10).forEach(r => {
    console.log(`Student: ${r.students?.student_name}, AcademicYear: ${r.academic_year}, Grade: ${r.grade}, Major: ${r.major}, Class: ${r.class_info}, Number: ${r.student_number}`);
  });

  const { data: allTeachers } = await supabase
    .from('student_academic_history')
    .select('teacher_name, major, class_info, grade, academic_year');

  const teacherMap = {};
  allTeachers.forEach(t => {
    const key = `${t.academic_year}년 ${t.grade}학년 ${t.major} ${t.class_info}반`;
    teacherMap[key] = t.teacher_name;
  });

  console.log('\n--- Academic History Teacher Mapping by Class ---');
  console.log(JSON.stringify(teacherMap, null, 2));
}

findSeojongdong();
