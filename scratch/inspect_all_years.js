const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAllYears() {
  const { data: students } = await supabase
    .from('students')
    .select('graduation_year, career_course, special_notes, career_aspiration');

  const yearCounts = {};
  students.forEach(s => {
    const gy = s.graduation_year || 'NULL';
    yearCounts[gy] = (yearCounts[gy] || 0) + 1;
  });

  console.log('--- Graduation Years in DB ---');
  console.log(JSON.stringify(yearCounts, null, 2));

  Object.keys(yearCounts).forEach(gy => {
    const stds = students.filter(s => String(s.graduation_year) === gy);
    const withCourse = stds.filter(s => s.career_course).length;
    const withNotes = stds.filter(s => s.special_notes).length;
    const withAsp = stds.filter(s => s.career_aspiration).length;
    console.log(`Year ${gy}: total=${stds.length}, withCourse=${withCourse}, withNotes=${withNotes}, withAsp=${withAsp}`);
  });
}

inspectAllYears();
