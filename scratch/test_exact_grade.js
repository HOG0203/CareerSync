const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExactGradeMatching() {
  const { data: teachers } = await supabase
    .from('profiles')
    .select('username, full_name, assigned_grade, assigned_year, assigned_major, assigned_class')
    .not('assigned_major', 'is', null);

  [1, 2, 3].forEach(grade => {
    console.log(`\n=== Testing Grade ${grade} Teacher Matching ===`);
    const majorClassList = [
      { major: '자동화기계과', class_info: '1' },
      { major: '자동화기계과', class_info: '2' },
      { major: '자동화기계과', class_info: '3' },
      { major: '자동화기계과', class_info: '4' },
      { major: '자동화기계과', class_info: '5' },
      { major: '친환경자동차과', class_info: '1' },
      { major: '친환경자동차과', class_info: '2' }
    ];

    majorClassList.forEach(item => {
      const cleanM = item.major.replace(/과|공업계/g, '').trim();
      const cleanC = item.class_info.replace(/반|학년/g, '').trim();

      const matchedT = teachers.find(t => {
        const tMajor = (t.assigned_major || '').replace(/과|공업계/g, '').trim();
        const tClass = (t.assigned_class || '').replace(/반|학년/g, '').trim();
        const isM = tMajor === cleanM || cleanM.includes(tMajor) || tMajor.includes(cleanM);
        const isC = tClass === cleanC;
        // Strictly match target grade!
        const isG = t.assigned_grade ? t.assigned_grade === grade : (t.assigned_year ? t.assigned_year === (2026 + (4 - grade)) : true);
        return isM && isC && isG;
      });

      console.log(`${grade}학년 ${item.major} ${item.class_info}반 -> 담임: ${matchedT ? (matchedT.username || matchedT.full_name) : '미지정'}`);
    });
  });
}

testExactGradeMatching();
