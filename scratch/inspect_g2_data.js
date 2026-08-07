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

async function inspectGrade2Data() {
  const baseYear = 2026;
  const grade = 2;
  const gradYear = (baseYear + (4 - grade)).toString(); // 2028

  const [studentsResult, historyResult, teachersResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, student_name, graduation_year, major, class_info, student_number')
      .eq('graduation_year', parseInt(gradYear)),
    supabase
      .from('student_academic_history')
      .select('*')
      .eq('academic_year', baseYear)
      .eq('grade', grade),
    supabase
      .from('profiles')
      .select('username, full_name, assigned_grade, assigned_major, assigned_class')
      .not('assigned_major', 'is', null)
  ]);

  const students = studentsResult.data || [];
  const historyData = historyResult.data || [];
  const teachers = teachersResult.data || [];

  console.log(`Total Grade 2 students in DB: ${students.length}`);
  console.log(`Total Grade 2 history records in DB: ${historyData.length}`);

  const grouped = {};
  students.forEach(s => {
    const hist = historyData.find(h => h.student_id === s.id);
    let teacherName = hist?.teacher_name;

    if (!teacherName) {
      const studentMajor = hist?.major || s.major;
      const studentClass = hist?.class_info || s.class_info;
      const studentGrade = hist?.grade || grade;
      
      const cleanM = (studentMajor || '').replace(/과|공업계/g, '').trim();
      const cleanC = (studentClass || '').replace(/반|학년/g, '').trim();

      const matchedT = teachers.find(t => {
        const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
        const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
        const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
        const isC = tClass === cleanC;
        const isG = !t.assigned_grade || t.assigned_grade === studentGrade;
        return isM && isC && isG;
      });

      if (matchedT) {
        teacherName = matchedT.username || matchedT.full_name;
      }
    }

    const shortM = MAJOR_MAP[s.major] || s.major;
    const label = `${shortM}${grade}-${s.class_info}`;
    if (!grouped[label]) grouped[label] = { label, teacherName, count: 0 };
    grouped[label].count++;
  });

  console.log('\n=== Grade 2 Class Headers & Teacher Names ===');
  Object.values(grouped).forEach(g => {
    console.log(`Header: [${g.label}] (${g.count}명) -> 담임교사: ${g.teacherName || '미지정'}`);
  });
}

inspectGrade2Data();
