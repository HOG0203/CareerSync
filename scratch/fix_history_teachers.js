const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAcademicHistoryTeachersWithAdmins() {
  const [teachersRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('username, full_name, assigned_major, assigned_class, assigned_grade').not('assigned_major', 'is', null),
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
      const isMajorMatch = tMajor === cleanMajor || cleanMajor.includes(tMajor) || tMajor.includes(cleanMajor);
      const isClassMatch = tClass === cleanClass;
      const isGradeMatch = !tGrade || tGrade === grade;
      return isMajorMatch && isClassMatch && isGradeMatch;
    });

    const correctTeacherName = matchedTeacher ? (matchedTeacher.username || matchedTeacher.full_name) : null;

    if (h.teacher_name !== correctTeacherName) {
      const { error } = await supabase
        .from('student_academic_history')
        .update({ teacher_name: correctTeacherName })
        .eq('id', h.id);

      if (!error) updatedCount++;
    }
  }

  console.log(`Successfully re-synced ${updatedCount} academic history teacher records (including Admin teachers)!`);
}

fixAcademicHistoryTeachersWithAdmins();
