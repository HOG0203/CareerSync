const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Import the parser logic
const parserPath = path.join(__dirname, '..', 'src', 'lib', 'employment-parser.ts');
console.log('Parser file updated.');

// Let's test reading an excel file
const testFiles = [
  '2026학년도_3학년_취업역량_산학교육_실적명단.xlsx',
  '2026학년도_전학년_취업역량_산학교육_실적명단.xlsx'
];

for (const tf of testFiles) {
  const fPath = path.join(__dirname, '..', 'public', tf);
  if (fs.existsSync(fPath)) {
    const buf = fs.readFileSync(fPath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    console.log(`\nFile: ${tf}, Sheets:`, wb.SheetNames);
    
    // Check 전공동아리명단 sheet
    const ws = wb.Sheets['전공동아리명단'];
    if (ws) {
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log('전공동아리명단 sample rows:', data.slice(0, 5));
    }
  }
}
