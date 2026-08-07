const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAdminTeachers() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, assigned_year, assigned_grade, assigned_major, assigned_class')
    .not('assigned_major', 'is', null);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- Profiles with assigned_major (ALL roles: teacher & admin) ---');
  profiles.forEach(p => {
    console.log(`Name: ${p.username || p.full_name} | Role: ${p.role} | Grade: ${p.assigned_grade} | Major: ${p.assigned_major} | Class: ${p.assigned_class}`);
  });
}

inspectAdminTeachers();
