const fs = require('fs');
const path = require('path');

const files = [
  'generate_arts_contest_excel.js',
  'generate_grade2_arts_contest_excel.js',
  'generate_grade1_arts_contest_excel.js'
];

for (const f of files) {
  const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
  console.log(`=== File: ${f} ===`);
  
  // Check if '검도' exists
  const hasKumdo = content.includes('검도');
  console.log(`Contains '검도': ${hasKumdo}`);

  // Find all lines with ③ 예체능활동
  const lines = content.split('\n');
  const sportsLines = new Set();
  lines.forEach(l => {
    if (l.includes('[ ③ 예체능활동') || l.includes('③ 예체능활동 참여점수 :') && !l.includes('③ 예체능활동 참여점수 : -')) {
      sportsLines.add(l.trim());
    }
  });
  console.log('Sports entries found:');
  sportsLines.forEach(l => console.log('  -', l));
}
