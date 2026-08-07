const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectAllProfilesDetailed() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total Teachers in profiles: ${profiles.length}`);
  profiles.forEach(p => {
    console.log(`ID: ${p.id} | Name: ${p.username || p.full_name} | AY: ${p.assigned_year} | Grade: ${p.assigned_grade} | Major: ${p.assigned_major} | Class: ${p.assigned_class}`);
  });
}

inspectAllProfilesDetailed();
