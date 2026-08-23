const fs = require('fs');
const path = require('path');

const g3Script = fs.readFileSync(path.join(__dirname, 'generate_arts_contest_excel.js'), 'utf8');
const lines = g3Script.split('\n');
let cur = '';
for (const l of lines) {
  if (l.includes('건설과') || l.includes('스마트') || l.includes('자동화') || l.includes('바이오') || l.includes('친환경')) {
    if (l.match(/^\s*\d\s+/)) cur = l.trim();
  }
  if (l.includes('[ ③ 예체능활동')) {
    console.log(cur, '-->', l.trim());
  }
}
