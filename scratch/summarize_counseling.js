const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeCounselingLogs() {
  const { data: logs, error } = await supabase
    .from('student_counseling_logs')
    .select('*, students(id, student_name, graduation_year, major, class_info, student_number)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total Counseling Logs: ${logs.length}`);

  const byTeacher = {};
  const byGrade = {};
  const byMajor = {};

  logs.forEach(log => {
    const teacher = log.author_name || '미기재';
    byTeacher[teacher] = (byTeacher[teacher] || 0) + 1;

    const std = log.students;
    if (std) {
      const gy = std.graduation_year;
      // settings baseYear is 2026 -> 2027=3학년, 2028=2학년, 2029=1학년
      const grade = gy === 2027 ? '3학년' : gy === 2028 ? '2학년' : gy === 2029 ? '1학년' : `${gy}졸업생`;
      byGrade[grade] = (byGrade[grade] || 0) + 1;

      const major = std.major || '미지정';
      byMajor[major] = (byMajor[major] || 0) + 1;
    }
  });

  console.log('\n--- 작성 교사별 상담 건수 ---');
  console.log(JSON.stringify(byTeacher, null, 2));

  console.log('\n--- 학년별 상담 건수 ---');
  console.log(JSON.stringify(byGrade, null, 2));

  console.log('\n--- 학과별 상담 건수 ---');
  console.log(JSON.stringify(byMajor, null, 2));

  console.log('\n--- 최근 상담 일지 10건 샘플 ---');
  logs.slice(0, 10).forEach((l, i) => {
    const std = l.students;
    const stdInfo = std ? `${std.major || ''} ${std.class_info || ''}반 ${std.student_name}` : '학생정보없음';
    const date = l.created_at ? new Date(l.created_at).toLocaleDateString('ko-KR') : '';
    console.log(`${i+1}. [${date}] ${l.author_name || '교사'} -> ${stdInfo}: ${l.content}`);
  });
}

analyzeCounselingLogs();
