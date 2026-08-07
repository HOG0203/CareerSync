const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectTeachersByGrade() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('username, assigned_major, assigned_class, assigned_grade, role')
    .eq('role', 'teacher')
    .not('assigned_major', 'is', null);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- Teacher Assignments in Profiles ---');
  profiles.forEach(p => {
    console.log(`${p.username}: Grade ${p.assigned_grade || 'All'}, Major ${p.assigned_major}, Class ${p.assigned_class}`);
  });
}

inspectTeachersByGrade();
