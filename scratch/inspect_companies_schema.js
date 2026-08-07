const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCompaniesSchema() {
  const { data: sample, error } = await supabase
    .from('companies')
    .select('*')
    .limit(3);

  if (error) {
    console.error('Error querying companies table:', error);
    return;
  }

  console.log('Sample rows in companies table:');
  console.log(JSON.stringify(sample, null, 2));
}

inspectCompaniesSchema();
