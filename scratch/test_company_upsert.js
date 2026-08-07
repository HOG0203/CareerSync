const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompanyUpsert() {
  const { data, error } = await supabase
    .from('companies')
    .upsert({
      name: '테스트업체_자동생성',
      location: '서울',
      company_type: '중소기업'
    }, { onConflict: 'name' })
    .select();

  if (error) {
    console.error('Upsert test error:', error);
  } else {
    console.log('Upsert test success:', data);
    // Cleanup test company
    await supabase.from('companies').delete().eq('name', '테스트업체_자동생성');
  }
}

testCompanyUpsert();
