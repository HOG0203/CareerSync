const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSettings() {
  const { data: settings } = await supabase.from('system_settings').select('*');
  console.log('System Settings:', settings);
}

inspectSettings();
