const { getCachedFilteredStudentData, getCachedGraduationYears, getCachedYearlyRankingsSummary } = require('../src/lib/data');

async function testStudentsSpeed() {
  console.time('Total /students Cached Data Fetch');

  const start1 = performance.now();
  const graduationYears = await getCachedGraduationYears();
  const end1 = performance.now();
  console.log(`Step 1 (GraduationYears Cache): ${(end1 - start1).toFixed(2)}ms`);

  const start2 = performance.now();
  const ay = 2026;
  const selectedYear = '2027';
  const [studentData, rankingMap] = await Promise.all([
    getCachedFilteredStudentData(selectedYear, ay),
    getCachedYearlyRankingsSummary(parseInt(selectedYear), ay)
  ]);
  const end2 = performance.now();
  console.log(`Step 2 (Student Data & Rankings Cache): ${(end2 - start2).toFixed(2)}ms (${studentData.length} students loaded)`);

  console.timeEnd('Total /students Cached Data Fetch');
}

testStudentsSpeed();
