const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAutoClass1History() {
  const { data: records, error } = await supabase
    .from('student_academic_history')
    .select('*, students(student_name, graduation_year)')
    .eq('major', '친환경자동차과')
    .eq('class_info', '1');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total student_academic_history rows for 친환경자동차과 1반: ${records.length}`);
  
  const groupedByGradYearAndGrade = {};
  records.forEach(r => {
    const gy = r.students?.graduation_year || 'UnknownGY';
    const key = `GraduationYear ${gy} (Grade ${r.grade}, AY ${r.academic_year})`;
    if (!groupedByGradYearAndGrade[key]) groupedByGradYearAndGrade[key] = [];
    groupedByGradYearAndGrade[key].push({
      student_name: r.students?.student_name,
      teacher_name: r.teacher_name
    });
  });

  Object.keys(groupedByGradYearAndGrade).forEach(key => {
    const list = groupedByGradYearAndGrade[key];
    const teachers = Array.from(new Set(list.map(x => x.teacher_name)));
    console.log(`\nKey: ${key} -> Total Students: ${list.length}, Teachers: ${JSON.stringify(teachers)}`);
    console.log('Sample students:', list.slice(0, 3));
  });
}

inspectAutoClass1History();
