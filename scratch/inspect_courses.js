const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectStudentCourses() {
  const { data: students, error } = await supabase
    .from('students')
    .select('student_name, graduation_year, major, class_info, career_aspiration, special_notes, career_course');

  if (error) {
    console.error('Error fetching students:', error);
    return;
  }

  console.log(`Total students across all years: ${students.length}`);

  const careerCourses = {};
  const specialNotes = {};
  const careerAspirations = {};

  students.forEach(s => {
    const cc = s.career_course || 'NULL/EMPTY';
    careerCourses[cc] = (careerCourses[cc] || 0) + 1;

    const sn = s.special_notes || 'NULL/EMPTY';
    specialNotes[sn] = (specialNotes[sn] || 0) + 1;

    const ca = s.career_aspiration || 'NULL/EMPTY';
    careerAspirations[ca] = (careerAspirations[ca] || 0) + 1;
  });

  console.log('\n--- Distribution of career_course ---');
  console.log(JSON.stringify(careerCourses, null, 2));

  console.log('\n--- Distribution of special_notes ---');
  console.log(JSON.stringify(specialNotes, null, 2));

  console.log('\n--- Distribution of career_aspiration ---');
  console.log(JSON.stringify(careerAspirations, null, 2));

  // Find any students containing '전문' or '미용' or '대학'
  const matchingStudents = students.filter(s => 
    JSON.stringify(s).includes('전문') || 
    JSON.stringify(s).includes('미용') ||
    JSON.stringify(s).includes('대학')
  );
  console.log(`\nStudents containing '전문', '미용', '대학': ${matchingStudents.length}`);
  if (matchingStudents.length > 0) {
    console.log(JSON.stringify(matchingStudents.slice(0, 10), null, 2));
  }
}

inspectStudentCourses();
