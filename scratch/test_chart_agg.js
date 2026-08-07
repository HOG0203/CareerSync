const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testChartAggregation() {
  const [studentsRes, employmentsRes] = await Promise.all([
    supabase.from('students').select('id, graduation_year, career_course'),
    supabase.from('student_employments').select('student_id, employment_status')
  ]);

  const students = studentsRes.data || [];
  const employments = employmentsRes.data || [];

  const empMap = {};
  employments.forEach(e => {
    empMap[e.student_id] = e.employment_status;
  });

  [2026, 2027, 2028].forEach(gy => {
    const gradeNum = gy === 2026 ? 3 : gy === 2027 ? 2 : 1;
    const gradeStudents = students.filter(s => s.graduation_year === gy);
    
    const counts = {};
    gradeStudents.forEach(s => {
      const empStatus = empMap[s.id];
      const course = (s.career_course && s.career_course.trim()) || (empStatus && empStatus.trim()) || '미설정';
      counts[course] = (counts[course] || 0) + 1;
    });

    console.log(`\n=== ${gradeNum}학년 (졸업연도 ${gy}) 진로코스 집계 ===`);
    console.log(JSON.stringify(counts, null, 2));
  });
}

testChartAggregation();
