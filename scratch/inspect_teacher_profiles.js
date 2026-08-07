const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectProfiles() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, assigned_major, assigned_class, assigned_grade, role');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Current Teacher Profiles in DB:');
  console.log(JSON.stringify(profiles, null, 2));
}

inspectProfiles();
