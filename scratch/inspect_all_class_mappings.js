const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAllClassMappings() {
  const [profilesRes, studentsRes, settingsRes] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, role, assigned_grade, assigned_major, assigned_class').eq('role', 'teacher'),
    supabase.from('students').select('graduation_year, major, class_info'),
    supabase.from('system_settings').select('*')
  ]);

  const profiles = profilesRes.data || [];
  const students = studentsRes.data || [];
  let baseYear = 2026;
  if (settingsRes.data) {
    const sysYear = settingsRes.data.find(s => s.key === 'base_year');
    if (sysYear?.value?.year) baseYear = sysYear.value.year;
  }

  console.log('=== All Teacher Profiles in User Management (profiles table) ===');
  profiles.forEach(p => {
    console.log(`Teacher: ${p.username || p.full_name} | Grade: ${p.assigned_grade} | Major: ${p.assigned_major} | Class: ${p.assigned_class}`);
  });

  // Extract all unique (grade, major, class_info) combinations in DB
  const classSet = new Map();
  students.forEach(s => {
    if (!s.graduation_year || !s.major || !s.class_info) return;
    const grade = 4 - (s.graduation_year - baseYear);
    if (grade < 1 || grade > 3) return;
    const key = `${grade}학년 ${s.major} ${s.class_info}반`;
    if (!classSet.has(key)) {
      classSet.set(key, { grade, major: s.major, class_info: s.class_info, count: 0 });
    }
    classSet.get(key).count++;
  });

  console.log(`\n=== Total Unique Classes in Students DB: ${classSet.size} ===`);

  classSet.forEach((val, key) => {
    const cleanMajor = val.major.replace(/과|공업계/g, '').trim();
    const cleanClass = val.class_info.replace(/반|학년/g, '').trim();

    const matchedTeacher = profiles.find(t => {
      if (!t.assigned_major || !t.assigned_class) return false;
      const tMajor = t.assigned_major.replace(/과|공업계/g, '').trim();
      const tClass = t.assigned_class.replace(/반|학년/g, '').trim();
      const tGrade = t.assigned_grade;

      // Check major match (flexible prefix/includes match for 스마트공간과 vs 스마트공간건축과, etc.)
      const isMajorMatch = tMajor === cleanMajor || cleanMajor.includes(tMajor) || tMajor.includes(cleanMajor);
      const isClassMatch = tClass === cleanClass;
      const isGradeMatch = !tGrade || tGrade === val.grade;

      return isMajorMatch && isClassMatch && isGradeMatch;
    });

    if (matchedTeacher) {
      console.log(`✅ [${key}] (${val.count}명) -> 담임: ${matchedTeacher.username || matchedTeacher.full_name}`);
    } else {
      console.log(`❌ [${key}] (${val.count}명) -> 담임 미배정 (profiles에서 매칭되는 교사 없음)`);
    }
  });
}

inspectAllClassMappings();
