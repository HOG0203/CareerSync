const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAcademicHistoryTeachers() {
  const [teachersRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('username, assigned_major, assigned_class, assigned_grade').eq('role', 'teacher'),
    supabase.from('student_academic_history').select('*')
  ]);

  const teachers = teachersRes.data || [];
  const history = historyRes.data || [];

  console.log(`Total history records to check/fix: ${history.length}`);
  let updatedCount = 0;

  for (const h of history) {
    const cleanMajor = (h.major || '').replace(/과|공업계/g, '').trim();
    const cleanClass = (h.class_info || '').replace(/반|학년/g, '').trim();
    const grade = h.grade;

    const matchedTeacher = teachers.find(t => {
      const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
      const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
      const tGrade = t.assigned_grade;
      return tMajor === cleanMajor && tClass === cleanClass && (tGrade ? tGrade === grade : true);
    });

    const correctTeacherName = matchedTeacher ? matchedTeacher.username : null;

    if (h.teacher_name !== correctTeacherName) {
      const { error } = await supabase
        .from('student_academic_history')
        .update({ teacher_name: correctTeacherName })
        .eq('id', h.id);

      if (!error) updatedCount++;
    }
  }

  console.log(`Successfully re-synced ${updatedCount} academic history teacher records!`);
}

fixAcademicHistoryTeachers();
