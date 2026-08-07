const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSeokyong() {
  const { data: teachers } = await supabase
    .from('profiles')
    .select('*')
    .or('username.eq.오석용,full_name.eq.오석용');

  console.log('Teacher 오석용 Profile in DB:');
  console.log(JSON.stringify(teachers, null, 2));

  const { data: g2c5 } = await supabase
    .from('profiles')
    .select('*')
    .eq('assigned_major', '자동화기계과')
    .eq('assigned_class', '5');

  console.log('\nTeachers assigned to 자동화기계과 5반:');
  console.log(JSON.stringify(g2c5, null, 2));
}

checkSeokyong();
