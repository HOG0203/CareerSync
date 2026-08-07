const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectGrade3Fields() {
  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .eq('graduation_year', 2026);

  if (error) {
    console.error(error);
    return;
  }

  const sample = students.filter(s => s.special_notes || s.career_aspiration || s.career_course);
  console.log(`Total 3rd grade students: ${students.length}`);
  console.log(`3rd grade students with career info: ${sample.length}`);
  
  if (sample.length > 0) {
    console.log('Sample 3rd grade student:', {
      student_name: sample[0].student_name,
      career_aspiration: sample[0].career_aspiration,
      special_notes: sample[0].special_notes,
      career_course: sample[0].career_course,
      remarks: sample[0].remarks
    });
  }

  const specialNotesCounts = {};
  students.forEach(s => {
    const sn = s.special_notes || '미설정';
    specialNotesCounts[sn] = (specialNotesCounts[sn] || 0) + 1;
  });
  console.log('\n--- 3학년 special_notes (희망 기업유형) ---');
  console.log(JSON.stringify(specialNotesCounts, null, 2));

  const aspirationsCounts = {};
  students.forEach(s => {
    const ca = s.career_aspiration || '미설정';
    aspirationsCounts[ca] = (aspirationsCounts[ca] || 0) + 1;
  });
  console.log('\n--- 3학년 career_aspiration (진로희망) ---');
  console.log(JSON.stringify(aspirationsCounts, null, 2));
}

inspectGrade3Fields();
