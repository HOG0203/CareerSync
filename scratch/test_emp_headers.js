const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAJOR_MAP = {
  '자동화기계과': '기계',
  '자동차기계과': '자동차',
  '친환경자동차과': '자동차',
  '전기과': '전기',
  '스마트전기과': '전기',
  '스마트공간건축과': '건축',
  '스마트공간과': '건축',
  '건설과': '건설',
  '섬유소재과': '섬유',
  '스마트융합섬유과': '섬유',
  '바이오화학과': '화학',
  '화학공업과': '화학',
};

async function testEmploymentStatusHeaders() {
  const baseYear = 2026;
  const grade = 3;
  const graduationYear = baseYear + (4 - grade); // 2027

  const [studentsRes, historyRes, teachersRes] = await Promise.all([
    supabase.from('students').select('id, student_name, graduation_year, major, class_info, student_number').eq('graduation_year', graduationYear),
    supabase.from('student_academic_history').select('student_id, teacher_name').eq('academic_year', baseYear),
    supabase.from('profiles').select('username, full_name, assigned_grade, assigned_major, assigned_class').not('assigned_major', 'is', null)
  ]);

  const students = studentsRes.data || [];
  const history = historyRes.data || [];
  const teachers = teachersRes.data || [];

  const historyMap = {};
  history.forEach(h => { historyMap[h.student_id] = h.teacher_name; });

  const grouped = {};
  students.forEach(s => {
    const shortMajor = (s.graduation_year >= 2028 && MAJOR_MAP[s.major] === '건축') ? '공간' : (MAJOR_MAP[s.major] || s.major);
    const label = `${shortMajor}${grade}-${s.class_info}`;
    if (!grouped[label]) grouped[label] = { label, major: s.major, class_info: s.class_info, students: [] };
    grouped[label].students.push({ ...s, teacher_name: historyMap[s.id] });
  });

  console.log(`=== ${grade}학년 (졸업연도 ${graduationYear}) 헤더 및 담임선생님 표시 결과 ===\n`);

  Object.values(grouped).forEach(g => {
    const cleanMajor = g.major.replace(/과|공업계/g, '').trim();
    const cleanClass = g.class_info.replace(/반|학년/g, '').trim();

    const matchedTeacher = teachers.find(t => {
      const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
      const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
      const isMajorMatch = tMajor === cleanMajor || cleanMajor.includes(tMajor) || tMajor.includes(cleanMajor);
      const isClassMatch = tClass === cleanClass;
      const isGradeMatch = !t.assigned_grade || t.assigned_grade === grade;
      return isMajorMatch && isClassMatch && isGradeMatch;
    });

    const teacherFromStudent = g.students.find(s => s.teacher_name)?.teacher_name;
    const finalTeacher = teacherFromStudent || matchedTeacher?.username || matchedTeacher?.full_name || '미지정';

    console.log(`[${g.label}] (${g.students.length}명) -> 담임교사: ${finalTeacher}T`);
  });
}

testEmploymentStatusHeaders();
