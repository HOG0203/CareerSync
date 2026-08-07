const { getCachedFilteredStudentData, getCachedGraduationYears, getCachedYearlyRankingsSummary, getCurrentUserProfile } = require('../src/lib/data');

async function testStudentsPageSpeed() {
  console.time('Full /students Page Data Fetching');

  const start1 = performance.now();
  const [settings, graduationYears] = await Promise.all([
    Promise.resolve({ baseYear: 2026 }),
    getCachedGraduationYears()
  ]);
  const end1 = performance.now();
  console.log(`Step 1 (Settings & GradYears): ${(end1 - start1).toFixed(2)}ms`);

  const start2 = performance.now();
  const selectedYear = '2027';
  const ay = 2026;
  const [rawStudentData, rankingMap] = await Promise.all([
    getCachedFilteredStudentData(selectedYear, ay),
    getCachedYearlyRankingsSummary(parseInt(selectedYear), settings.baseYear)
  ]);
  const end2 = performance.now();
  console.log(`Step 2 (Student Data & Rankings Cache): ${(end2 - start2).toFixed(2)}ms (Loaded ${rawStudentData.length} students)`);

  console.timeEnd('Full /students Page Data Fetching');
}

testStudentsPageSpeed();
