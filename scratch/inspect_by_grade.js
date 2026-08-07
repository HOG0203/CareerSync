const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectByGrade() {
  const { data: students, error } = await supabase
    .from('students')
    .select('student_name, graduation_year, career_course');

  if (error) {
    console.error(error);
    return;
  }

  [2026, 2027, 2028].forEach(gy => {
    const gradeLabel = gy === 2026 ? '3학년 (2026)' : gy === 2027 ? '2학년 (2027)' : '1학년 (2028)';
    const gradeStudents = students.filter(s => s.graduation_year === gy);
    const counts = {};
    gradeStudents.forEach(s => {
      const cc = s.career_course || '미설정';
      counts[cc] = (counts[cc] || 0) + 1;
    });
    console.log(`\n=== ${gradeLabel} Total: ${gradeStudents.length}명 ===`);
    console.log(JSON.stringify(counts, null, 2));
  });
}

inspectByGrade();
