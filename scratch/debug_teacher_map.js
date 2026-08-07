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

async function testWhyTeacherUnassigned() {
  const baseYear = 2026;
  const grade = 3;
  const graduationYear = baseYear + (4 - grade); // 2027

  // Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('username, full_name, assigned_grade, assigned_major, assigned_class')
    .not('assigned_major', 'is', null);

  const teacherMap = {};
  profiles.forEach(t => {
    const cleanMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
    const cleanClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
    const g = t.assigned_grade;
    const key = `${g || 'all'}_${cleanMajor}_${cleanClass}`;
    teacherMap[key] = t.username || t.full_name;
  });

  console.log('TeacherMap keys:', teacherMap);
}

testWhyTeacherUnassigned();
