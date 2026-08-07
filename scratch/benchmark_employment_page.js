const { getCachedFilteredStudentData, getCachedGraduationYears, getCachedTeacherProfiles } = require('../src/lib/data');

async function testEmploymentSpeed() {
  console.time('Total /employment-status Cached Fetch');

  const start1 = performance.now();
  const [gradYears, teacherProfiles] = await Promise.all([
    getCachedGraduationYears(),
    getCachedTeacherProfiles()
  ]);
  const end1 = performance.now();
  console.log(`Step 1 (GradYears & Cached Teacher Profiles): ${(end1 - start1).toFixed(2)}ms (${teacherProfiles.length} teachers)`);

  const start2 = performance.now();
  const studentData = await getCachedFilteredStudentData('2027', 2026);
  const end2 = performance.now();
  console.log(`Step 2 (Student Data Cache): ${(end2 - start2).toFixed(2)}ms (${studentData.length} students)`);

  console.timeEnd('Total /employment-status Cached Fetch');
}

testEmploymentSpeed();
