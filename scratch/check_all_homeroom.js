const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllHomeroomTeachers() {
  const [profilesRes, historyRes, settingsRes] = await Promise.all([
    supabase.from('profiles').select('username, assigned_grade, assigned_major, assigned_class').eq('role', 'teacher'),
    supabase.from('student_academic_history').select('grade, major, class_info, teacher_name'),
    supabase.from('system_settings').select('*')
  ]);

  const profiles = profilesRes.data || [];
  const history = historyRes.data || [];

  console.log('--- Teacher Profiles in DB ---');
  profiles.forEach(p => {
    console.log(`Teacher: ${p.username} -> Grade: ${p.assigned_grade}, Major: ${p.assigned_major}, Class: ${p.assigned_class}`);
  });

  const historyTeacherSet = {};
  history.forEach(h => {
    const key = `${h.grade}학년 ${h.major} ${h.class_info}반`;
    if (!historyTeacherSet[key]) historyTeacherSet[key] = new Set();
    if (h.teacher_name) historyTeacherSet[key].add(h.teacher_name);
  });

  console.log('\n--- Homeroom Teachers in Academic History by Class ---');
  Object.keys(historyTeacherSet).sort().forEach(key => {
    const teachers = Array.from(historyTeacherSet[key]);
    console.log(`${key}: ${teachers.length > 0 ? teachers.join(', ') : '❌ 담임 미지정(null)'}`);
  });
}

checkAllHomeroomTeachers();
