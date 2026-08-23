const ExcelJS = require('exceljs');
const path = require('path');

async function testRead(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`\n=== File: ${path.basename(filePath)} ===`);
  wb.eachSheet((ws, id) => {
    console.log(`Sheet [${id}]: ${ws.name}, Total Rows: ${ws.rowCount}`);
    for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
      const rowVals = ws.getRow(r).values;
      console.log(`  Row ${r}:`, JSON.stringify(rowVals.slice(1)));
    }
  });
}

async function check() {
  await testRead(path.join(__dirname, '..', 'public', '2026학년도_3학년_취업역량_산학교육_실적명단.xlsx'));
  await testRead(path.join(__dirname, '..', 'public', '2026학년도_2학년_취업역량_산학교육_실적명단.xlsx'));
}

check();
